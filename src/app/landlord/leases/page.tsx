import Link from "next/link";
import { redirect } from "next/navigation";

import {
  LeaseStatusFilterLinks,
  parseLeaseStatusFilter,
  type LeaseStatusFilter,
} from "@/components/leases/LeaseStatusFilter";
import { LeaseStatusBadge } from "@/components/leases/LeaseStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PaginatedTable, type TableColumn } from "@/components/shared/PaginatedTable";
import { currentIsoDateInUtc } from "@/lib/dates/currentDate";
import { describeLeaseLifecycle } from "@/lib/leases/describeLeaseLifecycle";
import { formatCentsAsCurrency } from "@/lib/money/formatCentsAsCurrency";
import { pageRange } from "@/lib/pagination/describePage";
import { isPageBeyondTheEnd } from "@/lib/pagination/isPageBeyondTheEnd";
import { parsePageNumber } from "@/lib/pagination/parsePageNumber";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const metadata = { title: "Leases" };

const PAGE_SIZE = 20;

type LeaseRow = {
  id: string;
  start_date: string;
  end_date: string;
  rent_amount_cents: number;
  units: { label: string; properties: { name: string } };
  tenant: { full_name: string } | null;
};

/**
 * Every tenancy, newest first, filtered by where it sits in its own life.
 *
 * The filter is applied in the query with the same comparison describeLeaseLifecycle makes: a
 * tenancy is active when today falls between its dates, both ends included. Filtering in the
 * database rather than in the page is what lets the list stay paged.
 */
export default async function LeasesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const { page: pageParameter, status } = await searchParams;
  const page = parsePageNumber(pageParameter);
  const statusFilter = parseLeaseStatusFilter(status);
  const { startIndex, endIndex } = pageRange({ page, pageSize: PAGE_SIZE });
  const today = currentIsoDateInUtc();

  const supabaseClient = await createSupabaseServerClient();
  let query = supabaseClient
    .from("leases")
    .select(
      "id, start_date, end_date, rent_amount_cents, units(label, properties(name)), tenant:profiles!leases_tenant_profile_id_fkey(full_name)",
      { count: "exact" },
    );

  if (statusFilter === "active") {
    query = query.lte("start_date", today).gte("end_date", today);
  }
  if (statusFilter === "upcoming") {
    query = query.gt("start_date", today);
  }
  if (statusFilter === "ended") {
    query = query.lt("end_date", today);
  }

  const {
    data: leases,
    count,
    error,
  } = await query.order("start_date", { ascending: false }).range(startIndex, endIndex);

  if (isPageBeyondTheEnd(error)) {
    redirect(
      statusFilter === "all" ? "/landlord/leases" : `/landlord/leases?status=${statusFilter}`,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Leases" description="Who rents what, for how long, and at what rent." />
        <Link
          href="/landlord/leases/new"
          className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-9 items-center rounded-md border border-transparent px-4 text-sm font-medium"
        >
          Record a tenancy
        </Link>
      </div>

      <LeaseStatusFilterLinks current={statusFilter} />

      <PaginatedTable
        caption="Your tenancies"
        columns={buildColumns(today)}
        rows={leases ?? []}
        rowKey={(row) => row.id}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={count ?? 0}
        basePath="/landlord/leases"
        currentQuery={{ status: statusFilter === "all" ? undefined : statusFilter }}
        emptyState={emptyStateFor(statusFilter)}
      />
    </div>
  );
}

function buildColumns(today: string): readonly TableColumn<LeaseRow>[] {
  return [
    {
      key: "unit",
      header: "Unit",
      cell: (row) => (
        <Link href={`/landlord/leases/${row.id}`} className="font-medium underline">
          {row.units.label} - {row.units.properties.name}
        </Link>
      ),
    },
    {
      key: "tenant",
      header: "Tenant",
      cell: (row) => row.tenant?.full_name ?? "No tenant account yet",
    },
    { key: "term", header: "Term", cell: (row) => `${row.start_date} to ${row.end_date}` },
    {
      key: "rent",
      header: "Rent",
      alignment: "right",
      cell: (row) => formatCentsAsCurrency(row.rent_amount_cents),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <LeaseStatusBadge
          lifecycle={describeLeaseLifecycle({
            startDate: row.start_date,
            endDate: row.end_date,
            currentDate: today,
          })}
        />
      ),
    },
  ];
}

function emptyStateFor(statusFilter: LeaseStatusFilter) {
  if (statusFilter === "all") {
    return (
      <EmptyState
        title="No tenancies yet"
        description="Record a tenancy against one of your units. The rent schedule and the tenant's own portal both follow from it."
        action={{ label: "Record a tenancy", href: "/landlord/leases/new" }}
      />
    );
  }

  return (
    <EmptyState
      title={`No ${statusFilter} tenancies`}
      description="Nothing matches this filter at the moment. The other filters may have what you are looking for."
      action={{ label: "Show all tenancies", href: "/landlord/leases" }}
    />
  );
}
