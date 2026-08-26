import Link from "next/link";

import { RentStatusBadge } from "@/components/leases/RentStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/classNames";
import { currentIsoDateInUtc } from "@/lib/dates/currentDate";
import { formatCentsAsCurrency } from "@/lib/money/formatCentsAsCurrency";
import { describeTenancyRent, type TenancyRent } from "@/lib/rent/describeTenancyRent";
import { totalArrearsInAgorot, type LeaseRentSummary } from "@/lib/rent/summariseOutstandingRent";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const metadata = { title: "Rent" };

/**
 * What every unit owes, in one place. This is business goal G4: the question "how much am I owed
 * right now" answered without arithmetic.
 *
 * The totals are aggregated by Postgres. The page reads lease_rent_summary, which is one row per
 * tenancy with the ledger already summed, and never touches a payment row: a landlord with three
 * years of history loads the same number of rows as one in their first month. The rule that turns
 * a total into arrears is applied here, over that handful of rows, because it depends on the rent
 * schedule and the schedule is a function of the lease rather than of the payments.
 */
export default async function RentOverviewPage() {
  const supabaseClient = await createSupabaseServerClient();
  const { data: summaries } = await supabaseClient
    .from("lease_rent_summary")
    .select(
      "lease_id, unit_label, property_name, tenant_full_name, start_date, end_date, rent_amount_cents, rent_due_day, total_paid_cents, last_received_on",
    )
    .order("unit_label", { ascending: true });

  const today = currentIsoDateInUtc();
  const rows = (summaries ?? [])
    .map((summary) => describeTenancyRent(summary, today))
    .filter((row) => row.lifecycle !== "ended" || row.summary.outstandingInAgorot > 0)
    .sort(byMostOwed);

  const arrears = totalArrearsInAgorot(rows.map((row) => row.summary));
  const inArrears = rows.filter((row) => row.summary.outstandingInAgorot > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rent"
        description="What each tenancy has been charged so far, what has arrived, and what is left."
      />

      <dl className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3">
        <Figure
          label="Outstanding across the portfolio"
          value={formatCentsAsCurrency(arrears)}
          isAlarming={arrears > 0}
        />
        <Figure
          label="Tenancies owing"
          value={`${inArrears.length} of ${rows.length}`}
          isAlarming={inArrears.length > 0}
        />
        <Figure
          label="Months overdue"
          value={String(rows.reduce((total, row) => total + row.summary.overduePeriodCount, 0))}
          isAlarming={rows.some((row) => row.summary.overduePeriodCount > 0)}
        />
      </dl>

      {rows.length === 0 ? (
        <EmptyState
          title="No rent to track yet"
          description="Once a tenancy is recorded, its rent schedule appears here and fills in as you record what arrives."
          action={{ label: "Record a tenancy", href: "/landlord/leases/new" }}
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <caption className="sr-only">Rent owed across every tenancy</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead className="text-right">Charged so far</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Oldest unpaid</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.leaseId}
                  className={cn(row.summary.overduePeriodCount > 0 && "bg-red-50/60")}
                >
                  <TableCell className="font-medium">
                    <Link href={`/landlord/leases/${row.leaseId}`} className="underline">
                      {row.unitLabel} - {row.propertyName}
                    </Link>
                  </TableCell>
                  <TableCell>{row.tenantName ?? "No tenant account yet"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCentsAsCurrency(row.summary.chargedToDateInAgorot)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCentsAsCurrency(row.summary.paidInAgorot)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {describeOutstanding(row.summary.outstandingInAgorot)}
                  </TableCell>
                  <TableCell>{row.summary.earliestOverdueDueDate ?? ""}</TableCell>
                  <TableCell>
                    <RentStatusBadge status={statusFor(row.summary)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/** What needs chasing comes first, largest arrears at the top. */
function byMostOwed(first: TenancyRent, second: TenancyRent): number {
  return second.summary.outstandingInAgorot - first.summary.outstandingInAgorot;
}

function statusFor(summary: LeaseRentSummary) {
  if (summary.overduePeriodCount > 0) {
    return "overdue" as const;
  }
  if (summary.outstandingInAgorot > 0) {
    return "partial" as const;
  }
  return "paid" as const;
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
  isAlarming,
}: {
  label: string;
  value: string;
  isAlarming: boolean;
}) {
  return (
    <div className="bg-background px-4 py-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={cn("text-xl font-medium tabular-nums", isAlarming && "text-red-700")}>
        {value}
      </dd>
    </div>
  );
}
