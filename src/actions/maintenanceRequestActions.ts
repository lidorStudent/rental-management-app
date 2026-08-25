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
import { requireTenantProfile } from "@/lib/authentication/requireTenantProfile";
import { currentIsoDateInUtc, currentTimestampInUtc } from "@/lib/dates/currentDate";
import { describeLeaseLifecycle, findActiveLease } from "@/lib/leases/describeLeaseLifecycle";
import {
  allowedNextStatuses,
  isAllowedMaintenanceStatusTransition,
  resolvedAtForStatus,
} from "@/lib/maintenance/allowedStatusTransitions";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import {
  confirmMaintenanceResolutionSchema,
  submitMaintenanceRequestSchema,
  updateMaintenanceRequestStatusSchema,
  type ConfirmMaintenanceResolutionInput,
  type SubmitMaintenanceRequestInput,
  type UpdateMaintenanceRequestStatusInput,
} from "@/lib/validation/maintenanceSchemas";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** The seven steps are described at the top of propertyActions.ts. */

const REQUEST_NOT_FOUND = "That request was not found.";

/**
 * Moving a reported problem along. Only the landlord can, and only by a route the transition map
 * allows: the control offers exactly what that map lists, and this refuses anything else, so the
 * buttons and the rule cannot drift apart.
 *
 * There is no delete. A reported problem stays in the history that both parties can read; closing
 * one is a status.
 */
export async function updateMaintenanceRequestStatus(
  input: UpdateMaintenanceRequestStatusInput,
): Promise<ActionResult<{ requestId: string }>> {
  await requireLandlordProfile();

  const parsed = updateMaintenanceRequestStatusSchema.safeParse(input);
  if (!parsed.success) {
    return validationErrorResult(parsed.error);
  }

  const supabaseClient = await createSupabaseServerClient();

  const { data: request, error: requestError } = await supabaseClient
    .from("maintenance_requests")
    .select("id, status, lease_id")
    .eq("id", parsed.data.requestId)
    .maybeSingle();

  if (requestError !== null) {
    return unexpectedFailureResult("updateMaintenanceRequestStatus", requestError);
  }
  if (request === null) {
    return errorResult(REQUEST_NOT_FOUND);
  }

  if (!isAllowedMaintenanceStatusTransition(request.status, parsed.data.nextStatus)) {
    return errorResult(
      `A request that is ${readable(request.status)} can only become ${allowedNextStatuses(request.status).map(readable).join(" or ")}.`,
    );
  }

  const { data: updated, error } = await supabaseClient
    .from("maintenance_requests")
    .update({
      status: parsed.data.nextStatus,
      // Resolved and "has a resolution date" are the same fact, so reopening clears the date. The
      // database enforces the pairing too, with a check constraint.
      resolved_at: resolvedAtForStatus(parsed.data.nextStatus, currentTimestampInUtc()),
      // A tenant confirms a particular resolution. Moving the request at all, including resolving
      // it again after a reopen, is a new resolution that has not been confirmed yet.
      tenant_confirmed_at: null,
    })
    .eq("id", request.id)
    .select("id, lease_id")
    .maybeSingle();

  if (error !== null) {
    return unexpectedFailureResult("updateMaintenanceRequestStatus", error);
  }
  if (updated === null) {
    return errorResult(REQUEST_NOT_FOUND);
  }

  revalidatePath("/landlord");
  revalidatePath("/landlord/maintenance");
  revalidatePath(`/landlord/maintenance/${updated.id}`);
  revalidatePath("/tenant/maintenance");

  return successResult({ requestId: updated.id });
}

/** The enum values are database identifiers; these are the words a person reads. */
function readable(status: string): string {
  return status.replace("_", " ");
}

/**
 * Reporting a problem. The tenant's lease is resolved from their session and never taken from the
 * input, so there is nothing in the payload that could point at another flat: not the lease, not
 * the landlord, not the reporter.
 */
export async function submitMaintenanceRequest(
  input: SubmitMaintenanceRequestInput,
): Promise<ActionResult<{ requestId: string }>> {
  const tenant = await requireTenantProfile();

  const parsed = submitMaintenanceRequestSchema.safeParse(input);
  if (!parsed.success) {
    return validationErrorResult(parsed.error);
  }

  const supabaseClient = await createSupabaseServerClient();

  const lookup = await findTheTenantsActiveLease(supabaseClient, "submitMaintenanceRequest");
  if (lookup.outcome === "problem") {
    return lookup.result;
  }

  const { data: created, error } = await supabaseClient
    .from("maintenance_requests")
    .insert({
      lease_id: lookup.lease.id,
      // Both of these come from the lease the session resolved to, not from the form.
      landlord_id: lookup.lease.landlordId,
      submitted_by: tenant.id,
      title: parsed.data.title,
      description: parsed.data.description,
      urgency: parsed.data.urgency ?? "normal",
      status: "submitted",
    })
    .select("id")
    .maybeSingle();

  if (error !== null || created === null) {
    return unexpectedFailureResult("submitMaintenanceRequest", error);
  }

  revalidatePath("/landlord");
  revalidatePath("/landlord/maintenance");
  revalidatePath("/tenant");
  revalidatePath("/tenant/maintenance");

  return successResult({ requestId: created.id });
}

/**
 * The tenant agreeing that a resolved request really was fixed. It is the only write a tenant has
 * besides reporting a problem, and it touches one column: the database refuses anything else, both
 * through the confirm policy and through the trigger that compares the rest of the row.
 *
 * A request belonging to another tenant is invisible to this query, so it produces the same "not
 * found" as a request that does not exist.
 */
export async function confirmMaintenanceRequestResolved(
  input: ConfirmMaintenanceResolutionInput,
): Promise<ActionResult<{ requestId: string }>> {
  await requireTenantProfile();

  const parsed = confirmMaintenanceResolutionSchema.safeParse(input);
  if (!parsed.success) {
    return validationErrorResult(parsed.error);
  }

  const supabaseClient = await createSupabaseServerClient();

  const { data: request, error: requestError } = await supabaseClient
    .from("maintenance_requests")
    .select("id, status, tenant_confirmed_at")
    .eq("id", parsed.data.requestId)
    .maybeSingle();

  if (requestError !== null) {
    return unexpectedFailureResult("confirmMaintenanceRequestResolved", requestError);
  }
  if (request === null) {
    return errorResult(REQUEST_NOT_FOUND);
  }
  if (request.status !== "resolved") {
    return errorResult(
      "This request is still open. You can confirm it once your landlord marks it resolved.",
    );
  }
  // Confirming twice is not a mistake worth an error message; the second one simply has nothing to
  // do. The policy would refuse the write anyway, and that refusal would read as "not found".
  if (request.tenant_confirmed_at !== null) {
    return successResult({ requestId: request.id });
  }

  const { data: confirmed, error } = await supabaseClient
    .from("maintenance_requests")
    .update({ tenant_confirmed_at: currentTimestampInUtc() })
    .eq("id", request.id)
    .select("id")
    .maybeSingle();

  if (error !== null) {
    return unexpectedFailureResult("confirmMaintenanceRequestResolved", error);
  }
  if (confirmed === null) {
    return errorResult(REQUEST_NOT_FOUND);
  }

  revalidatePath("/landlord");
  revalidatePath("/landlord/maintenance");
  revalidatePath(`/landlord/maintenance/${confirmed.id}`);
  revalidatePath("/tenant/maintenance");

  return successResult({ requestId: confirmed.id });
}

type ActiveLeaseLookup =
  | { outcome: "active"; lease: { id: string; landlordId: string } }
  | { outcome: "problem"; result: ActionResult<never> };

/**
 * The tenancy the signed-in tenant is living under today.
 *
 * Row Level Security already limits this query to leases where the tenant is this user, so the
 * lease is derived twice over: once by the policy and once by the date rule. A tenant without an
 * active tenancy is not an error, it is an ordinary state with a sentence that explains it, so the
 * portal never shows an error page to somebody whose lease simply ended.
 */
async function findTheTenantsActiveLease(
  supabaseClient: SupabaseClient<Database>,
  actionName: string,
): Promise<ActiveLeaseLookup> {
  const today = currentIsoDateInUtc();

  const { data: leaseRows, error } = await supabaseClient
    .from("leases")
    .select("id, landlord_id, start_date, end_date")
    .order("start_date", { ascending: false });

  if (error !== null) {
    return { outcome: "problem", result: unexpectedFailureResult(actionName, error) };
  }

  const leases = leaseRows.map((lease) => ({
    id: lease.id,
    landlordId: lease.landlord_id,
    startDate: lease.start_date,
    endDate: lease.end_date,
  }));

  const activeLease = findActiveLease(leases, today);
  if (activeLease !== null) {
    return { outcome: "active", lease: activeLease };
  }

  return { outcome: "problem", result: errorResult(explainWhyThereIsNoActiveLease(leases, today)) };
}

function explainWhyThereIsNoActiveLease(
  leases: readonly { startDate: string; endDate: string }[],
  today: string,
): string {
  const mostRecent = leases[0];
  if (mostRecent === undefined) {
    return "No tenancy is recorded for your account yet. Your landlord adds one when your lease begins.";
  }

  const lifecycle = describeLeaseLifecycle({
    startDate: mostRecent.startDate,
    endDate: mostRecent.endDate,
    currentDate: today,
  });

  if (lifecycle === "upcoming") {
    return `Your tenancy starts on ${mostRecent.startDate}. You can report a problem once it has begun.`;
  }
  return `Your tenancy ended on ${mostRecent.endDate}. Your rent history stays here, but new problems go to your landlord directly.`;
}
