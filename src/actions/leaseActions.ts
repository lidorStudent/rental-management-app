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
import { nextDay } from "@/lib/dates/isoDate";
import { findConflictingLease, type ExistingLease } from "@/lib/leases/findConflictingLease";
import { firstDayOfTheMonthOf } from "@/lib/rent/isPeriodMonthWithinLease";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import {
  createLeaseSchema,
  endLeaseSchema,
  renewLeaseSchema,
  type CreateLeaseInput,
  type EndLeaseInput,
  type RenewLeaseInput,
} from "@/lib/validation/leaseSchemas";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** The seven steps are described at the top of propertyActions.ts. */

const LEASE_NOT_FOUND = "That lease was not found.";
const UNIT_NOT_FOUND = "That unit was not found.";
const OVERLAP_CONSTRAINT_CODE = "23P01";

export async function createLease(
  input: CreateLeaseInput,
): Promise<ActionResult<{ leaseId: string }>> {
  const landlord = await requireLandlordProfile();

  const parsed = createLeaseSchema.safeParse(input);
  if (!parsed.success) {
    return validationErrorResult(parsed.error);
  }

  const supabaseClient = await createSupabaseServerClient();

  const { data: unit, error: unitError } = await supabaseClient
    .from("units")
    .select("id, property_id")
    .eq("id", parsed.data.unitId)
    .maybeSingle();

  if (unitError !== null) {
    return unexpectedFailureResult("createLease", unitError);
  }
  if (unit === null) {
    return errorResult(UNIT_NOT_FOUND);
  }

  const conflictOrFailure = await refuseIfDatesAreTaken(supabaseClient, {
    unitId: unit.id,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
  });
  if (conflictOrFailure !== null) {
    return conflictOrFailure;
  }

  const { data: created, error } = await supabaseClient
    .from("leases")
    .insert({
      unit_id: unit.id,
      landlord_id: landlord.id,
      rent_amount_cents: parsed.data.rentAmount,
      deposit_amount_cents: parsed.data.depositAmount,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      rent_due_day: parsed.data.rentDueDay,
    })
    .select("id")
    .maybeSingle();

  if (error !== null || created === null) {
    return leaseWriteFailure("createLease", error);
  }

  revalidateLeasePaths(created.id, unit.property_id);

  return successResult({ leaseId: created.id });
}

/**
 * Ending a tenancy early. Only the end date moves: the rent that was agreed and the day it falls due
 * are matters of record, and a lease that is already running is not a form to be re-typed.
 */
export async function endLease(
  input: EndLeaseInput,
): Promise<ActionResult<{ leaseId: string; recordedPaymentsAfterNewEndDate: number }>> {
  await requireLandlordProfile();

  const parsed = endLeaseSchema.safeParse(input);
  if (!parsed.success) {
    return validationErrorResult(parsed.error);
  }

  const supabaseClient = await createSupabaseServerClient();

  const { data: lease, error: leaseError } = await supabaseClient
    .from("leases")
    .select("id, unit_id, start_date, end_date")
    .eq("id", parsed.data.leaseId)
    .maybeSingle();

  if (leaseError !== null) {
    return unexpectedFailureResult("endLease", leaseError);
  }
  if (lease === null) {
    return errorResult(LEASE_NOT_FOUND);
  }

  const endDateProblem = refuseIfNewEndDateIsNotEarlier(parsed.data.endDate, lease);
  if (endDateProblem !== null) {
    return endDateProblem;
  }

  // Shrinking a date range cannot collide with anything the original range did not already collide
  // with, so this can only pass. It runs anyway, so that every write to a lease's dates goes through
  // the same gate and no future change to the end rule can quietly skip it.
  const conflictOrFailure = await refuseIfDatesAreTaken(supabaseClient, {
    unitId: lease.unit_id,
    startDate: lease.start_date,
    endDate: parsed.data.endDate,
    leaseIdBeingEdited: lease.id,
  });
  if (conflictOrFailure !== null) {
    return conflictOrFailure;
  }

  // Not a blocker, but the landlord should know: rent already recorded for months beyond the new end
  // date is still in the ledger, and the schedule will no longer show a period for it.
  const { count: paymentsAfter, error: countError } = await supabaseClient
    .from("rent_payments")
    .select("id", { count: "exact", head: true })
    .eq("lease_id", lease.id)
    .gt("period_month", firstDayOfTheMonthOf(parsed.data.endDate));

  if (countError !== null) {
    return unexpectedFailureResult("endLease", countError);
  }

  const { data: updated, error } = await supabaseClient
    .from("leases")
    .update({ end_date: parsed.data.endDate })
    .eq("id", lease.id)
    .select("id, unit_id")
    .maybeSingle();

  if (error !== null) {
    return leaseWriteFailure("endLease", error);
  }
  if (updated === null) {
    return errorResult(LEASE_NOT_FOUND);
  }

  await revalidateAfterLeaseWrite(supabaseClient, updated.id, updated.unit_id);

  return successResult({
    leaseId: updated.id,
    recordedPaymentsAfterNewEndDate: countOrZero(paymentsAfter),
  });
}

/**
 * Renewing writes a new lease rather than extending the old one, so that the tenancy history reads
 * as what happened: one agreement ended and another began, each with its own rent.
 *
 * The unit and the tenant come from the lease being renewed, never from the input. A client that
 * could name them could renew somebody else's tenancy onto its own unit.
 */
export async function renewLease(
  input: RenewLeaseInput,
): Promise<ActionResult<{ leaseId: string }>> {
  const landlord = await requireLandlordProfile();

  const parsed = renewLeaseSchema.safeParse(input);
  if (!parsed.success) {
    return validationErrorResult(parsed.error);
  }

  const supabaseClient = await createSupabaseServerClient();

  const { data: expiringLease, error: leaseError } = await supabaseClient
    .from("leases")
    .select("id, unit_id, tenant_profile_id, end_date")
    .eq("id", parsed.data.leaseId)
    .maybeSingle();

  if (leaseError !== null) {
    return unexpectedFailureResult("renewLease", leaseError);
  }
  if (expiringLease === null) {
    return errorResult(LEASE_NOT_FOUND);
  }

  const conflictOrFailure = await refuseIfDatesAreTaken(supabaseClient, {
    unitId: expiringLease.unit_id,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
  });
  if (conflictOrFailure !== null) {
    return conflictOrFailure;
  }

  const { data: created, error } = await supabaseClient
    .from("leases")
    .insert({
      unit_id: expiringLease.unit_id,
      landlord_id: landlord.id,
      tenant_profile_id: expiringLease.tenant_profile_id,
      rent_amount_cents: parsed.data.rentAmount,
      deposit_amount_cents: parsed.data.depositAmount,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      rent_due_day: parsed.data.rentDueDay,
    })
    .select("id")
    .maybeSingle();

  if (error !== null || created === null) {
    return leaseWriteFailure("renewLease", error);
  }

  await revalidateAfterLeaseWrite(supabaseClient, created.id, expiringLease.unit_id);

  return successResult({ leaseId: created.id });
}

/**
 * Domain invariant 1, checked here so that the refusal can name the tenancy that is in the way.
 *
 * The guarantee is the leases_no_overlap exclusion constraint, not this: two tabs can both read "no
 * conflict" before either writes. `leaseWriteFailure` maps the constraint's error code back to the
 * same sentence for the race that gets through.
 */
async function refuseIfDatesAreTaken(
  supabaseClient: SupabaseClient<Database>,
  proposed: {
    unitId: string;
    startDate: string;
    endDate: string;
    leaseIdBeingEdited?: string;
  },
): Promise<ActionResult<never> | null> {
  const { data: leasesOnUnit, error } = await supabaseClient
    .from("leases")
    .select("id, unit_id, start_date, end_date")
    .eq("unit_id", proposed.unitId);

  if (error !== null) {
    return unexpectedFailureResult("refuseIfDatesAreTaken", error);
  }

  const existingLeases: ExistingLease[] = leasesOnUnit.map((lease) => ({
    leaseId: lease.id,
    unitId: lease.unit_id,
    startDate: lease.start_date,
    endDate: lease.end_date,
  }));

  const conflict = findConflictingLease(proposed, existingLeases);
  if (conflict === null) {
    return null;
  }

  const earliestFreeDate = nextDay(conflict.endDate);

  return errorResult(
    `This unit is already let from ${conflict.startDate} to ${conflict.endDate}. Both of those days belong to that tenancy, so a new one can start on ${earliestFreeDate} at the earliest.`,
    {
      startDate: `Occupied until ${conflict.endDate}. Free from ${earliestFreeDate}.`,
      endDate: `Overlaps the tenancy running to ${conflict.endDate}.`,
    },
  );
}

/**
 * Ending a lease brings its end date forward, and nothing else. An end date after the current one
 * would be an extension, which is a renewal with a new rent and a new agreement, not an edit.
 */
function refuseIfNewEndDateIsNotEarlier(
  newEndDate: string,
  lease: { start_date: string; end_date: string },
): ActionResult<never> | null {
  if (newEndDate <= lease.start_date) {
    return errorResult("A tenancy must end after it started.", {
      endDate: `This lease began on ${lease.start_date}.`,
    });
  }
  if (newEndDate >= lease.end_date) {
    return errorResult("Ending a lease brings its end date forward.", {
      endDate: `This lease already ends on ${lease.end_date}. To extend it, renew it instead.`,
    });
  }
  return null;
}

function leaseWriteFailure(
  actionName: string,
  error: { code?: string; message: string } | null,
): ActionResult<never> {
  if (error?.code === OVERLAP_CONSTRAINT_CODE) {
    return errorResult(
      "This unit was let for part of those dates a moment ago. Reload the lease list and try again.",
    );
  }
  return unexpectedFailureResult(actionName, error);
}

function revalidateLeasePaths(leaseId: string, propertyId: string): void {
  revalidatePath("/landlord");
  revalidatePath("/landlord/leases");
  revalidatePath(`/landlord/leases/${leaseId}`);
  revalidatePath(`/landlord/properties/${propertyId}`);
  revalidatePath("/tenant");
}

/** The property page lists its units and their current tenancies, so it changes too. */
async function revalidateAfterLeaseWrite(
  supabaseClient: SupabaseClient<Database>,
  leaseId: string,
  unitId: string,
): Promise<void> {
  const { data: unit } = await supabaseClient
    .from("units")
    .select("property_id")
    .eq("id", unitId)
    .maybeSingle();

  if (unit === null) {
    revalidatePath("/landlord");
    revalidatePath("/landlord/leases");
    revalidatePath(`/landlord/leases/${leaseId}`);
    revalidatePath("/tenant");
    return;
  }

  revalidateLeasePaths(leaseId, unit.property_id);
}

/** A head count comes back as null when Postgres declines to count; nothing counted is zero. */
function countOrZero(count: number | null): number {
  return count === null ? 0 : count;
}
