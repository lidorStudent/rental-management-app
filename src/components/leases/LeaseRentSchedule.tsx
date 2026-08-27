import { RentScheduleTable } from "@/components/leases/RentScheduleTable";
import { currentIsoDateInUtc } from "@/lib/dates/currentDate";
import { formatCentsAsCurrency } from "@/lib/money/formatCentsAsCurrency";
import { buildRentScheduleWithStatus } from "@/lib/rent/buildRentSchedule";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

/**
 * The rent schedule of one tenancy, with a status against every month.
 *
 * The amounts come from lease_period_totals, an aggregate the database computes: one row per month
 * that has had anything paid against it. The payments themselves are never read here, so a tenancy
 * with three hundred part payments costs the same to display as one with thirty.
 */
export async function LeaseRentSchedule({
  leaseId,
  lease,
}: {
  leaseId: string;
  lease: { startDate: string; endDate: string; rentAmountInAgorot: number; rentDueDay: number };
}) {
  const supabaseClient = await createSupabaseServerClient();
  const { data: periodTotals } = await supabaseClient
    .from("lease_period_totals")
    .select("period_month, paid_cents")
    .eq("lease_id", leaseId);

  const paidByPeriodMonth = new Map(
    (periodTotals ?? []).map((row) => [row.period_month ?? "", Number(row.paid_cents ?? 0)]),
  );

  const periods = buildRentScheduleWithStatus({
    lease,
    paidByPeriodMonth,
    currentDate: currentIsoDateInUtc(),
  });

  const overduePeriods = periods.filter((period) => period.status === "overdue");
  const outstandingNow = periods
    .filter((period) => period.dueDate <= currentIsoDateInUtc())
    .reduce((total, period) => total + period.outstandingInAgorot, 0);

  return (
    <div className="space-y-3">
      {overduePeriods.length === 0 ? null : (
        <p
          role="status"
          className="border-status-critical-line bg-status-critical-tint text-status-critical-ink rounded-md border px-3 py-2 text-sm font-medium"
        >
          {overduePeriods.length === 1
            ? "1 month is overdue"
            : `${overduePeriods.length} months are overdue`}
          , {formatCentsAsCurrency(Math.max(0, outstandingNow))} outstanding. The oldest fell due on{" "}
          {overduePeriods[0]?.dueDate}.
        </p>
      )}

      <RentScheduleTable periods={periods} />
    </div>
  );
}
