import Link from "next/link";
import { notFound } from "next/navigation";

import { RentPaymentForm, type PeriodChoice } from "@/components/payments/RentPaymentForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { currentIsoDateInUtc } from "@/lib/dates/currentDate";
import { buildRentScheduleWithStatus } from "@/lib/rent/buildRentSchedule";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const metadata = { title: "Record a payment" };

/**
 * The month is pre-selected to the oldest one that is not settled, because that is what a payment
 * almost always is: the arrears being caught up. The landlord can pick another.
 */
export default async function NewRentPaymentPage({
  params,
}: {
  params: Promise<{ leaseId: string }>;
}) {
  const { leaseId } = await params;
  const supabaseClient = await createSupabaseServerClient();

  // Both reads are keyed on the lease id from the URL and neither needs the other's answer, so they
  // go together rather than one after the other.
  //
  // That puts the period totals before the notFound() guard below, which is deliberate and safe. The
  // totals query carries no owner filter of its own; Row Level Security answers it as the signed-in
  // landlord, so a lease belonging to somebody else returns no rows here for exactly the same reason
  // the lease read returns none. Asking discloses nothing, and the answer is thrown away when the
  // guard fires on the next line.
  const [{ data: lease }, { data: periodTotals }] = await Promise.all([
    supabaseClient
      .from("leases")
      .select(
        "id, start_date, end_date, rent_amount_cents, rent_due_day, units(label, properties(name))",
      )
      .eq("id", leaseId)
      .maybeSingle(),
    supabaseClient
      .from("lease_period_totals")
      .select("period_month, paid_cents")
      .eq("lease_id", leaseId),
  ]);

  if (lease === null) {
    notFound();
  }

  const today = currentIsoDateInUtc();
  const periods = buildRentScheduleWithStatus({
    lease: {
      startDate: lease.start_date,
      endDate: lease.end_date,
      rentAmountInAgorot: lease.rent_amount_cents,
      rentDueDay: lease.rent_due_day,
    },
    paidByPeriodMonth: new Map(
      (periodTotals ?? []).map((row) => [row.period_month ?? "", Number(row.paid_cents ?? 0)]),
    ),
    currentDate: today,
  });

  const oldestUnsettled = periods.find((period) => period.status !== "paid");
  const periodChoices: PeriodChoice[] = periods.map((period) => ({
    periodMonth: period.periodMonth,
    label: `${period.periodMonth.slice(0, 7)} - due ${period.dueDate}`,
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href={`/landlord/leases/${lease.id}`}
        className="text-muted-foreground text-sm underline"
      >
        Back to the tenancy
      </Link>
      <PageHeader
        title="Record a payment"
        description={`Money received for ${lease.units.label} at ${lease.units.properties.name}. Recording it is what updates the schedule and the tenant's own view.`}
      />
      <RentPaymentForm
        mode="record"
        leaseId={lease.id}
        periods={periodChoices}
        today={today}
        defaultPeriodMonth={oldestUnsettled?.periodMonth ?? periods[0]?.periodMonth ?? today}
      />
    </div>
  );
}
