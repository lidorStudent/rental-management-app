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
import { currentTimestampInUtc } from "@/lib/dates/currentDate";
import {
  allowedNextStatuses,
  isAllowedMaintenanceStatusTransition,
  resolvedAtForStatus,
} from "@/lib/maintenance/allowedStatusTransitions";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import {
  updateMaintenanceRequestStatusSchema,
  type UpdateMaintenanceRequestStatusInput,
} from "@/lib/validation/maintenanceSchemas";

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
