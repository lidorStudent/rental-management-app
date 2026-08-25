import Link from "next/link";
import { notFound } from "next/navigation";

import { RentPaymentForm, type PeriodChoice } from "@/components/payments/RentPaymentForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { currentIsoDateInUtc } from "@/lib/dates/currentDate";
import { buildRentSchedule } from "@/lib/rent/buildRentSchedule";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const metadata = { title: "Correct a payment" };

/**
 * Correcting an entry rather than deleting one. The row keeps its identity and who recorded it, so
 * the history still says what happened, and the tenancy cannot be changed: a payment can never be
 * moved onto somebody else's ledger.
 */
export default async function CorrectRentPaymentPage({
  params,
}: {
  params: Promise<{ leaseId: string; paymentId: string }>;
}) {
  const { leaseId, paymentId } = await params;
  const supabaseClient = await createSupabaseServerClient();

  const { data: payment } = await supabaseClient
    .from("rent_payments")
    .select(
      "id, lease_id, period_month, amount_cents, received_on, method, reference, leases(start_date, end_date, rent_amount_cents, rent_due_day, units(label))",
    )
    .eq("id", paymentId)
    .eq("lease_id", leaseId)
    .maybeSingle();

  if (payment === null) {
    notFound();
  }

  const periodChoices: PeriodChoice[] = buildRentSchedule({
    startDate: payment.leases.start_date,
    endDate: payment.leases.end_date,
    rentAmountInAgorot: payment.leases.rent_amount_cents,
    rentDueDay: payment.leases.rent_due_day,
  }).map((period) => ({
    periodMonth: period.periodMonth,
    label: `${period.periodMonth.slice(0, 7)} - due ${period.dueDate}`,
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href={`/landlord/leases/${leaseId}`}
        className="text-muted-foreground text-sm underline"
      >
        Back to the tenancy
      </Link>
      <PageHeader
        title="Correct this payment"
        description={`Recorded against ${payment.leases.units.label}. Correcting it leaves the entry in place; nothing is deleted.`}
      />
      <RentPaymentForm
        mode="correct"
        paymentId={payment.id}
        leaseId={leaseId}
        periods={periodChoices}
        today={currentIsoDateInUtc()}
        defaultPeriodMonth={payment.period_month}
        initialValues={{
          leaseId,
          periodMonth: payment.period_month,
          amount: (payment.amount_cents / 100).toFixed(2),
          receivedOn: payment.received_on,
          method: payment.method,
          reference: payment.reference ?? "",
        }}
      />
    </div>
  );
}
