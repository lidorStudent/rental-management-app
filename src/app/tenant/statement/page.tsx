import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PrintButton } from "@/components/statement/PrintButton";
import { RentStatement } from "@/components/statement/RentStatement";
import { StatementDateRangeForm } from "@/components/statement/StatementDateRangeForm";
import { loadTenantLease } from "@/components/tenant/loadTenantLease";
import { currentIsoDateInUtc } from "@/lib/dates/currentDate";
import { chooseStatementRange } from "@/lib/rent/statementPeriodRange";

export const metadata = { title: "Rent statement" };

/**
 * The tenant's own statement, for proving what they have paid.
 *
 * There is no lease id in this URL and no way to put one there. The tenancy is resolved from the
 * session, exactly as it is on every other tenant page, so a statement for somebody else's tenancy
 * is not a request this route can express.
 */
export default async function TenantStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const lease = await loadTenantLease();

  if (lease === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Rent statement" />
        <EmptyState
          title="No tenancy recorded yet"
          description="A statement lists what was charged and what you paid. Yours appears once your landlord records your tenancy."
        />
      </div>
    );
  }

  const range = chooseStatementRange({
    requestedFrom: from,
    requestedTo: to,
    leaseStartDate: lease.startDate,
    leaseEndDate: lease.endDate,
    currentDate: currentIsoDateInUtc(),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/tenant/payments" className="text-muted-foreground text-sm underline">
          Back to your payments
        </Link>
        <PrintButton />
      </div>

      <StatementDateRangeForm action="/tenant/statement" range={range} />

      <RentStatement leaseId={lease.id} range={range} />
    </div>
  );
}
