"use server";

import { revalidatePath } from "next/cache";

import {
  errorResult,
  successResult,
  unexpectedFailureResult,
  validationErrorResult,
  type ActionResult,
} from "@/lib/actionResult";
import { requireLandlordProfile } from "@/lib/authentication/requireLandlordProfile";
import { createSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { generateTemporaryPassword } from "@/lib/temporaryPassword";
import {
  createTenantAccountSchema,
  regenerateTenantPasswordSchema,
  type CreateTenantAccountInput,
  type RegenerateTenantPasswordInput,
} from "@/lib/validation/authenticationSchemas";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Vague on purpose. A landlord has a legitimate reason to know that an address will not work, but
 * not to learn which addresses already have accounts on this system.
 */
const EMAIL_UNAVAILABLE_MESSAGE =
  "That email address cannot be used for a tenant account. Use a different one, or ask the tenant which address they already sign in with.";

const LEASE_ALREADY_HAS_A_TENANT_MESSAGE = "This lease already has a tenant account.";

/**
 * Said only when the account was created and then could not be removed again. The landlord has to
 * know an account exists under that address, because the alternative is that they try the same
 * address again and are told it is unavailable, with nothing explaining why.
 */
const ACCOUNT_MAY_REMAIN_MESSAGE =
  "An account may now exist for that email address. Check with your tenant before creating another one.";

export type TemporaryPasswordIssued = {
  temporaryPassword: string;
  tenantEmail: string;
};

/**
 * Creates the tenant's account for a lease and hands the landlord a temporary password to pass on
 * however they normally talk to that tenant. There is no email service in this product, by design.
 *
 * The password is returned once and stored nowhere: after this call the only copy that exists is
 * the hash inside Supabase Auth. If the landlord loses it, regenerateTenantPassword issues a new
 * one; nothing can retrieve the old one.
 */
export async function createTenantAccountForLease(
  input: CreateTenantAccountInput,
): Promise<ActionResult<TemporaryPasswordIssued>> {
  await requireLandlordProfile();

  const parsed = createTenantAccountSchema.safeParse(input);
  if (!parsed.success) {
    return validationErrorResult(parsed.error);
  }

  const supabaseClient = await createSupabaseServerClient();

  // Read as the landlord, so Row Level Security decides whether this lease is theirs. A lease that
  // belongs to someone else comes back as no rows, exactly like a lease that does not exist.
  const { data: lease, error: leaseError } = await supabaseClient
    .from("leases")
    .select("id, tenant_profile_id")
    .eq("id", parsed.data.leaseId)
    .maybeSingle();

  if (leaseError !== null) {
    return unexpectedFailureResult("createTenantAccountForLease", leaseError);
  }
  if (lease === null) {
    return errorResult("That lease was not found.");
  }
  if (lease.tenant_profile_id !== null) {
    return errorResult(LEASE_ALREADY_HAS_A_TENANT_MESSAGE);
  }

  const temporaryPassword = generateTemporaryPassword();
  const adminClient = createSupabaseAdminClient();

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: parsed.data.tenantEmail,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      role: "tenant",
      full_name: parsed.data.tenantFullName,
      must_change_password: true,
    },
  });

  if (createError !== null || created.user === null) {
    console.error("createTenantAccountForLease could not create the account", {
      code: createError?.code,
    });
    return errorResult(EMAIL_UNAVAILABLE_MESSAGE, { tenantEmail: EMAIL_UNAVAILABLE_MESSAGE });
  }

  const attachFailure = await attachTenantOrUndoTheAccount(
    supabaseClient,
    parsed.data.leaseId,
    created.user.id,
  );
  if (attachFailure !== null) {
    return attachFailure;
  }

  revalidatePath(`/landlord/leases/${parsed.data.leaseId}`);

  return successResult({ temporaryPassword, tenantEmail: parsed.data.tenantEmail });
}

/**
 * Attaches the new account to its lease, or removes the account again and says why.
 *
 * Compare and set, not a plain write. The caller's "this lease has no tenant" check was a read, and
 * between it and this update another submission for the same lease can attach its own tenant.
 * Filtering on the column still being null means the second write matches no rows rather than
 * overwriting the first, which would leave the first account attached to nothing and able to sign in
 * to an empty portal.
 */
async function attachTenantOrUndoTheAccount(
  supabaseClient: SupabaseClient<Database>,
  leaseId: string,
  userId: string,
): Promise<ActionResult<never> | null> {
  const { data: attached, error: attachError } = await supabaseClient
    .from("leases")
    .update({ tenant_profile_id: userId })
    .eq("id", leaseId)
    .is("tenant_profile_id", null)
    .select("id");

  if (attachError !== null) {
    console.error("createTenantAccountForLease could not attach the tenant", {
      code: attachError.code,
    });
    return undoTheAccountAndExplain({
      userId,
      reason: "the link failed",
      whenRemoved: "The account could not be linked to the lease. Nothing was created.",
      whenLeftBehind: `The account could not be linked to the lease, and could not be removed again either. ${ACCOUNT_MAY_REMAIN_MESSAGE}`,
    });
  }

  if (!attached?.length) {
    return undoTheAccountAndExplain({
      userId,
      reason: "another submission attached a tenant first",
      whenRemoved: LEASE_ALREADY_HAS_A_TENANT_MESSAGE,
      whenLeftBehind: `${LEASE_ALREADY_HAS_A_TENANT_MESSAGE} ${ACCOUNT_MAY_REMAIN_MESSAGE}`,
    });
  }

  return null;
}

/**
 * Undoes the account when it could not be attached to its lease, and says which of the two things
 * happened.
 *
 * The distinction is the point. Telling a landlord nothing was created when the account is still
 * there sends them away from the problem rather than towards it, and the account they were not told
 * about is one that can sign in.
 */
async function undoTheAccountAndExplain({
  userId,
  reason,
  whenRemoved,
  whenLeftBehind,
}: {
  userId: string;
  reason: string;
  whenRemoved: string;
  whenLeftBehind: string;
}): Promise<ActionResult<never>> {
  const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(userId);

  if (error !== null) {
    console.error(`createTenantAccountForLease could not undo the account after ${reason}`, {
      code: error.code,
    });
    return errorResult(whenLeftBehind);
  }
  return errorResult(whenRemoved);
}

/**
 * Issues a new temporary password for a lease that already has a tenant account, for the tenant
 * who has forgotten theirs. With no email service there is no self-service reset, so the landlord
 * is the reset mechanism.
 */
export async function regenerateTenantPassword(
  input: RegenerateTenantPasswordInput,
): Promise<ActionResult<TemporaryPasswordIssued>> {
  await requireLandlordProfile();

  const parsed = regenerateTenantPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return validationErrorResult(parsed.error);
  }

  const supabaseClient = await createSupabaseServerClient();

  const { data: lease, error: leaseError } = await supabaseClient
    .from("leases")
    .select("id, tenant_profile_id")
    .eq("id", parsed.data.leaseId)
    .maybeSingle();

  if (leaseError !== null) {
    return unexpectedFailureResult("regenerateTenantPassword", leaseError);
  }
  if (lease === null) {
    return errorResult("That lease was not found.");
  }
  if (lease.tenant_profile_id === null) {
    return errorResult("This lease has no tenant account yet.");
  }

  const temporaryPassword = generateTemporaryPassword();
  const adminClient = createSupabaseAdminClient();

  // The flag is written before the password, and the order is the whole point.
  //
  // These are two writes against two different services, so there is no transaction across them and
  // one of them can fail with the other already done. What can be chosen is which half-finished
  // state is left behind:
  //
  //   flag first    a flag set with no new password asks the tenant to replace a password they
  //                 still know. Mildly annoying, harmless, and it clears itself the moment they do.
  //   password first  a new password with no flag hands the landlord a working password the tenant
  //                 will never be forced to replace, which is the one state this flag exists to
  //                 prevent.
  //
  // Undoing is not available in either order: a password is stored as a hash, so the previous one
  // cannot be put back. Since one of the two states has to be survivable, it is the cheap one.
  const { error: flagError } = await adminClient
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", lease.tenant_profile_id);

  if (flagError !== null) {
    console.error("regenerateTenantPassword could not require a password change", {
      code: flagError.code,
    });
    return errorResult(
      "The password was not reset. The account could not be marked as needing a new one first, so nothing was changed. Try again.",
    );
  }

  const { data: updated, error: updateError } = await adminClient.auth.admin.updateUserById(
    lease.tenant_profile_id,
    { password: temporaryPassword },
  );

  if (updateError !== null || updated.user === null) {
    console.error("regenerateTenantPassword could not set the password", {
      code: updateError?.code,
    });
    return errorResult(
      "The new password could not be set. Your tenant's current password still works, but they will now be asked to replace it when they next sign in. Try again to issue a new one.",
    );
  }

  revalidatePath(`/landlord/leases/${parsed.data.leaseId}`);

  return successResult({
    temporaryPassword,
    tenantEmail: updated.user.email ?? "",
  });
}
