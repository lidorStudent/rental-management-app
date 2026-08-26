import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/classNames";
import { currentIsoDateInUtc } from "@/lib/dates/currentDate";
import { addDays } from "@/lib/dates/isoDate";
import { formatCentsAsCurrency } from "@/lib/money/formatCentsAsCurrency";
import { describeTenancyRent } from "@/lib/rent/describeTenancyRent";
import { totalArrearsInAgorot } from "@/lib/rent/summariseOutstandingRent";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { firstDayOfTheMonthOf } from "@/lib/rent/isPeriodMonthWithinLease";

const DAYS_AHEAD_TO_WARN_ABOUT_ENDINGS = 60;

/**
 * The first screen a landlord sees: what needs attention, and nothing else.
 *
 * Four database round trips, and no figure on this page is computed by fetching rows and adding
 * them up in JavaScript:
 *
 *   1. rent_collected_by_month, filtered to this month. A view that groups rent_payments by
 *      landlord and month, so this is one row containing a sum Postgres computed.
 *   2. lease_rent_summary, every row. One row per tenancy, each already carrying the total received
 *      against it. Three of the five figures come from this one query: what is overdue, how many
 *      units are occupied, and which tenancies end soon. The arrears rule is applied over this
 *      handful of rows rather than over payments, because it depends on the rent schedule, and the
 *      schedule is derived from the lease rather than stored.
 *   3. units, count only, with head: true. Postgres returns the number and no rows at all.
 *   4. maintenance_requests, count only, with head: true, filtered to anything not resolved.
 *
 * It was seven queries before the second one was made to serve three figures instead of one: there
 * were separate round trips for the occupied unit count and for the tenancies ending soon, both of
 * which are answered by rows already on their way.
 */
export async function DashboardOverview() {
  const supabaseClient = await createSupabaseServerClient();
  const today = currentIsoDateInUtc();
  const endingBefore = addDays(today, DAYS_AHEAD_TO_WARN_ABOUT_ENDINGS);

  const [collectedThisMonth, tenancies, unitCount, openRequestCount] = await Promise.all([
    supabaseClient
      .from("rent_collected_by_month")
      .select("collected_cents, payment_count")
      .eq("month", firstDayOfTheMonthOf(today))
      .maybeSingle(),
    supabaseClient
      .from("lease_rent_summary")
      .select(
        "lease_id, unit_label, property_name, tenant_full_name, start_date, end_date, rent_amount_cents, rent_due_day, total_paid_cents",
      ),
    supabaseClient.from("units").select("id", { count: "exact", head: true }),
    supabaseClient
      .from("maintenance_requests")
      .select("id", { count: "exact", head: true })
      .neq("status", "resolved"),
  ]);

  const totalUnits = orZero(unitCount.count);

  if (totalUnits === 0) {
    return (
      <EmptyState
        title="Nothing to show yet"
        description="Add the first building and the units inside it. Tenancies, rent and reported problems all hang off a unit, so everything on this page follows from that."
        action={{ label: "Add a property", href: "/landlord/properties/new" }}
      />
    );
  }

  const summaries = (tenancies.data ?? []).map((tenancy) => describeTenancyRent(tenancy, today));

  const arrears = totalArrearsInAgorot(summaries.map((tenancy) => tenancy.summary));

  // One active tenancy means one occupied unit: the exclusion constraint on leases makes two
  // overlapping tenancies on a unit impossible, so counting the active ones counts the units.
  const occupiedUnits = summaries.filter((tenancy) => tenancy.lifecycle === "active").length;

  const endingSoon = summaries
    .filter((tenancy) => tenancy.endDate >= today && tenancy.endDate <= endingBefore)
    .sort((first, second) => first.endDate.localeCompare(second.endDate));

  return (
    <div className="space-y-6">
      <dl className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          label="Rent collected this month"
          value={formatCentsAsCurrency(orZero(collectedThisMonth.data?.collected_cents))}
          detail={describePaymentCount(orZero(collectedThisMonth.data?.payment_count))}
          href="/landlord/rent"
        />
        <Figure
          label="Outstanding"
          value={formatCentsAsCurrency(arrears)}
          detail={arrears === 0 ? "Nothing owed" : "Across every tenancy"}
          href="/landlord/rent"
          isAlarming={arrears > 0}
        />
        <Figure
          label="Open problems"
          value={String(orZero(openRequestCount.count))}
          detail="Reported and not resolved"
          href="/landlord/maintenance?status=open"
          isAlarming={orZero(openRequestCount.count) > 0}
        />
        <Figure
          label="Occupancy"
          value={`${occupiedUnits} of ${totalUnits}`}
          detail={occupiedUnits === totalUnits ? "Every unit is let" : "Units currently let"}
          href="/landlord/properties"
        />
      </dl>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">
            Ending in the next {DAYS_AHEAD_TO_WARN_ABOUT_ENDINGS} days
          </h2>
          <Link href="/landlord/leases?status=active" className="text-sm underline">
            All active tenancies
          </Link>
        </div>

        {endingSoon.length === 0 ? (
          <p className="text-muted-foreground rounded-md border px-4 py-3 text-sm">
            Nothing ends in the next {DAYS_AHEAD_TO_WARN_ABOUT_ENDINGS} days.
          </p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {endingSoon.map((tenancy) => (
              <li
                key={tenancy.leaseId}
                className="flex flex-wrap justify-between gap-2 px-4 py-2.5"
              >
                <Link
                  href={`/landlord/leases/${tenancy.leaseId}`}
                  className="font-medium underline"
                >
                  {tenancy.unitLabel} - {tenancy.propertyName}
                </Link>
                <span className="text-muted-foreground">
                  {tenancy.tenantName ?? "No tenant account"}, ends {tenancy.endDate}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Figure({
  label,
  value,
  detail,
  href,
  isAlarming = false,
}: {
  label: string;
  value: string;
  detail: string;
  href: string;
  isAlarming?: boolean;
}) {
  return (
    <div className="bg-background">
      <Link href={href} className="hover:bg-accent block px-4 py-3">
        <dt className="text-muted-foreground text-xs">{label}</dt>
        <dd className={cn("text-xl font-medium tabular-nums", isAlarming && "text-red-700")}>
          {value}
        </dd>
        <p className="text-muted-foreground mt-0.5 text-xs">{detail}</p>
      </Link>
    </div>
  );
}

function orZero(value: number | null | undefined): number {
  return value ?? 0;
}

function describePaymentCount(paymentCount: number): string {
  if (paymentCount === 0) {
    return "Nothing recorded yet this month";
  }
  return paymentCount === 1 ? "1 payment recorded" : `${paymentCount} payments recorded`;
}
