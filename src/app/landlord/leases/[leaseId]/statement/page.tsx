import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/statement/PrintButton";
import { RentStatement } from "@/components/statement/RentStatement";
import { StatementDateRangeForm } from "@/components/statement/StatementDateRangeForm";
import { currentIsoDateInUtc } from "@/lib/dates/currentDate";
import { chooseStatementRange } from "@/lib/rent/statementPeriodRange";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const metadata = { title: "Rent statement" };

/**
 * The landlord's statement for one of their tenancies.
 *
 * The lease id comes from the URL, and is not trusted: the lease is read as the signed-in landlord,
 * so one belonging to somebody else comes back as no rows and is answered with the same not-found
 * page as a lease that does not exist.
 */
export default async function LandlordStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ leaseId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { leaseId } = await params;
  const { from, to } = await searchParams;

  const supabaseClient = await createSupabaseServerClient();
  const { data: lease } = await supabaseClient
    .from("leases")
    .select("id, start_date, end_date")
    .eq("id", leaseId)
    .maybeSingle();

  if (lease === null) {
    notFound();
  }

  const range = chooseStatementRange({
    requestedFrom: from,
    requestedTo: to,
    leaseStartDate: lease.start_date,
    leaseEndDate: lease.end_date,
    currentDate: currentIsoDateInUtc(),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/landlord/leases/${lease.id}`}
          className="text-muted-foreground text-sm underline"
        >
          Back to the tenancy
        </Link>
        <PrintButton />
      </div>

      <StatementDateRangeForm action={`/landlord/leases/${lease.id}/statement`} range={range} />

      <RentStatement leaseId={lease.id} range={range} />
    </div>
  );
}
