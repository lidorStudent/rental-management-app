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
import { currentIsoDateInUtc } from "@/lib/dates/currentDate";
import { isPeriodMonthWithinLease } from "@/lib/rent/isPeriodMonthWithinLease";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import {
  buildRecordRentPaymentSchema,
  buildUpdateRentPaymentSchema,
  type RecordRentPaymentInput,
  type UpdateRentPaymentInput,
} from "@/lib/validation/rentPaymentSchemas";

/** The seven steps are described at the top of propertyActions.ts. */

const LEASE_NOT_FOUND = "That lease was not found.";
const PAYMENT_NOT_FOUND = "That payment was not found.";

/**
 * Domain invariant 5: this is a record of money the landlord says arrived. Nothing here moves money,
 * and no tenant can reach this action, because there is no tenant policy for writing to the ledger.
 */
export async function recordRentPayment(
  input: RecordRentPaymentInput,
): Promise<ActionResult<{ paymentId: string }>> {
  const landlord = await requireLandlordProfile();

  // The clock is read here, at the edge, and handed to the rule. Nothing inside the schema or the
  // rules asks what day it is.
  const parsed = buildRecordRentPaymentSchema(currentIsoDateInUtc()).safeParse(input);
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
    return unexpectedFailureResult("recordRentPayment", leaseError);
  }
  if (lease === null) {
    return errorResult(LEASE_NOT_FOUND);
  }

  const periodProblem = refuseIfPeriodIsOutsideLease(parsed.data.periodMonth, lease);
  if (periodProblem !== null) {
    return periodProblem;
  }

  const { data: created, error } = await supabaseClient
    .from("rent_payments")
    .insert({
      lease_id: lease.id,
      landlord_id: landlord.id,
      // Who recorded it is the acting user, never a value from the form. This is the column a
      // dispute is settled with.
      recorded_by: landlord.id,
      period_month: parsed.data.periodMonth,
      amount_cents: parsed.data.amount,
      received_on: parsed.data.receivedOn,
      method: parsed.data.method,
      reference: parsed.data.reference ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error !== null || created === null) {
    return unexpectedFailureResult("recordRentPayment", error);
  }

  revalidateLedgerPaths(lease.id);

  return successResult({ paymentId: created.id });
}

/**
 * A correction, not a deletion. P4 of the product specification names "recorded against the wrong
 * period" as the case to handle, and the row keeps its identity and its recorded_by, so the history
 * still says who entered it.
 *
 * The lease is not among the fields that can change: a payment cannot be moved onto another tenancy.
 */
export async function correctRentPayment(
  input: UpdateRentPaymentInput,
): Promise<ActionResult<{ paymentId: string }>> {
  await requireLandlordProfile();

  const parsed = buildUpdateRentPaymentSchema(currentIsoDateInUtc()).safeParse(input);
  if (!parsed.success) {
    return validationErrorResult(parsed.error);
  }

  const supabaseClient = await createSupabaseServerClient();

  const { data: payment, error: paymentError } = await supabaseClient
    .from("rent_payments")
    .select("id, lease_id")
    .eq("id", parsed.data.paymentId)
    .maybeSingle();

  if (paymentError !== null) {
    return unexpectedFailureResult("correctRentPayment", paymentError);
  }
  if (payment === null) {
    return errorResult(PAYMENT_NOT_FOUND);
  }

  const { data: lease, error: leaseError } = await supabaseClient
    .from("leases")
    .select("id, start_date, end_date")
    .eq("id", payment.lease_id)
    .maybeSingle();

  if (leaseError !== null) {
    return unexpectedFailureResult("correctRentPayment", leaseError);
  }
  if (lease === null) {
    return errorResult(LEASE_NOT_FOUND);
  }

  const periodProblem = refuseIfPeriodIsOutsideLease(parsed.data.periodMonth, lease);
  if (periodProblem !== null) {
    return periodProblem;
  }

  const { data: updated, error } = await supabaseClient
    .from("rent_payments")
    .update({
      period_month: parsed.data.periodMonth,
      amount_cents: parsed.data.amount,
      received_on: parsed.data.receivedOn,
      method: parsed.data.method,
      reference: parsed.data.reference ?? null,
    })
    .eq("id", payment.id)
    .select("id")
    .maybeSingle();

  if (error !== null) {
    return unexpectedFailureResult("correctRentPayment", error);
  }
  if (updated === null) {
    return errorResult(PAYMENT_NOT_FOUND);
  }

  revalidateLedgerPaths(lease.id);

  return successResult({ paymentId: updated.id });
}

/**
 * A payment settles a rent period, and a lease only implies periods for the months it runs. Paying
 * for a month the tenancy never covered would put money in the ledger that no period can account
 * for, and the statement would not balance.
 */
function refuseIfPeriodIsOutsideLease(
  periodMonth: string,
  lease: { start_date: string; end_date: string },
): ActionResult<never> | null {
  const withinLease = isPeriodMonthWithinLease({
    periodMonth,
    leaseStartDate: lease.start_date,
    leaseEndDate: lease.end_date,
  });

  if (withinLease) {
    return null;
  }

  return errorResult("That month is outside this tenancy.", {
    periodMonth: `This lease runs from ${lease.start_date} to ${lease.end_date}.`,
  });
}

function revalidateLedgerPaths(leaseId: string): void {
  revalidatePath("/landlord");
  revalidatePath("/landlord/leases");
  revalidatePath(`/landlord/leases/${leaseId}`);
  revalidatePath("/tenant");
  revalidatePath("/tenant/payments");
}
