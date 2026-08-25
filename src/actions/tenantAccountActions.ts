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

/**
 * Vague on purpose. A landlord has a legitimate reason to know that an address will not work, but
 * not to learn which addresses already have accounts on this system.
 */
const EMAIL_UNAVAILABLE_MESSAGE =
  "That email address cannot be used for a tenant account. Use a different one, or ask the tenant which address they already sign in with.";

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
    return errorResult("This lease already has a tenant account.");
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

  const { error: attachError } = await supabaseClient
    .from("leases")
    .update({ tenant_profile_id: created.user.id })
    .eq("id", parsed.data.leaseId);

  if (attachError !== null) {
    // The account exists but is attached to nothing, which would leave an orphan that can sign in
    // and see an empty portal. Undo it rather than leaving that behind.
    await adminClient.auth.admin.deleteUser(created.user.id);
    console.error("createTenantAccountForLease could not attach the tenant", {
      code: attachError.code,
    });
    return errorResult("The account could not be linked to the lease. Nothing was created.");
  }

  revalidatePath(`/landlord/leases/${parsed.data.leaseId}`);

  return successResult({ temporaryPassword, tenantEmail: parsed.data.tenantEmail });
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

  const { data: updated, error: updateError } = await adminClient.auth.admin.updateUserById(
    lease.tenant_profile_id,
    { password: temporaryPassword },
  );

  if (updateError !== null || updated.user === null) {
    console.error("regenerateTenantPassword could not set the password", {
      code: updateError?.code,
    });
    return errorResult("The password could not be reset. Try again.");
  }

  const { error: flagError } = await adminClient
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", lease.tenant_profile_id);

  if (flagError !== null) {
    console.error("regenerateTenantPassword could not set must_change_password", {
      code: flagError.code,
    });
  }

  revalidatePath(`/landlord/leases/${parsed.data.leaseId}`);

  return successResult({
    temporaryPassword,
    tenantEmail: updated.user.email ?? "",
  });
}
