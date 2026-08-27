import { RentStatusBadge } from "@/components/leases/RentStatusBadge";
import { currentIsoDateInUtc } from "@/lib/dates/currentDate";
import { formatCentsAsCurrency } from "@/lib/money/formatCentsAsCurrency";
import { buildRentScheduleWithStatus } from "@/lib/rent/buildRentSchedule";
import { firstDayOfTheMonthOf } from "@/lib/rent/isPeriodMonthWithinLease";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import type { TenantLease } from "@/components/tenant/loadTenantLease";

/**
 * Where the tenant stands on rent: this month, and everything owed so far.
 *
 * The lease comes from the session, and the amounts come from lease_period_totals, an aggregate
 * Postgres computes, so a tenant with three years of payments loads one row per month rather than
 * one per payment. The status is derived from those amounts and today's date, exactly as it is on
 * the landlord's side, by the same function.
 */
export async function TenantRentPosition({ lease }: { lease: TenantLease }) {
  const supabaseClient = await createSupabaseServerClient();
  const { data: periodTotals } = await supabaseClient
    .from("lease_period_totals")
    .select("period_month, paid_cents")
    .eq("lease_id", lease.id);

  const today = currentIsoDateInUtc();
  const periods = buildRentScheduleWithStatus({
    lease: {
      startDate: lease.startDate,
      endDate: lease.endDate,
      rentAmountInAgorot: lease.rentAmountInAgorot,
      rentDueDay: lease.rentDueDay,
    },
    paidByPeriodMonth: new Map(
      (periodTotals ?? []).map((row) => [row.period_month ?? "", Number(row.paid_cents ?? 0)]),
    ),
    currentDate: today,
  });

  const thisMonth = periods.find((period) => period.periodMonth === firstDayOfTheMonthOf(today));
  const payableSoFar = periods.filter((period) => period.dueDate <= today);
  const outstanding = payableSoFar.reduce((total, period) => total + period.outstandingInAgorot, 0);
  const overdueCount = periods.filter((period) => period.status === "overdue").length;

  return (
    <div className="space-y-3">
      <dl className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3">
        <Figure
          label="This month"
          value={
            thisMonth === undefined
              ? "No rent this month"
              : formatCentsAsCurrency(thisMonth.amountDueInAgorot)
          }
          detail={thisMonth === undefined ? "Outside your tenancy" : `Due ${thisMonth.dueDate}`}
          badge={thisMonth === undefined ? null : <RentStatusBadge status={thisMonth.status} />}
        />
        <Figure
          label="Outstanding"
          value={describeOutstanding(outstanding)}
          detail={
            outstanding > 0
              ? "Everything charged so far, less what your landlord has recorded"
              : "Nothing owed"
          }
        />
        <Figure
          label="Months overdue"
          value={String(overdueCount)}
          detail={overdueCount === 0 ? "Nothing past its due date" : "Past their due date"}
        />
      </dl>

      {overdueCount === 0 ? null : (
        <p
          role="status"
          className="border-status-critical-line bg-status-critical-tint text-status-critical-ink rounded-md border px-4 py-3 text-sm"
        >
          {overdueCount === 1 ? "One month is" : `${overdueCount} months are`} past the due date. If
          you have paid and it is not shown here, tell your landlord: rent is recorded by them when
          it arrives, not taken automatically.
        </p>
      )}
    </div>
  );
}

function describeOutstanding(outstandingInAgorot: number): string {
  if (outstandingInAgorot < 0) {
    return `${formatCentsAsCurrency(-outstandingInAgorot)} in credit`;
  }
  return formatCentsAsCurrency(outstandingInAgorot);
}

function Figure({
  label,
  value,
  detail,
  badge,
}: {
  label: string;
  value: string;
  detail: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="flex flex-wrap items-center gap-2 text-xl font-medium tabular-nums">
        {value}
        {badge}
      </dd>
      <p className="text-muted-foreground mt-0.5 text-xs">{detail}</p>
    </div>
  );
}
