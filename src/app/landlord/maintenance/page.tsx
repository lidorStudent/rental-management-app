import Link from "next/link";
import { redirect } from "next/navigation";

import {
  MaintenanceFilters,
  buildHref,
  parseStatusFilter,
  parseUrgencyFilter,
  type MaintenanceStatusFilter,
  type MaintenanceUrgencyFilter,
} from "@/components/maintenance/MaintenanceFilters";
import {
  MaintenanceStatusBadge,
  URGENCY_WORDS,
} from "@/components/maintenance/MaintenanceStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PaginatedTable, type TableColumn } from "@/components/shared/PaginatedTable";
import type { MaintenanceStatus } from "@/lib/maintenance/allowedStatusTransitions";
import { pageRange } from "@/lib/pagination/describePage";
import { isPageBeyondTheEnd } from "@/lib/pagination/isPageBeyondTheEnd";
import { parsePageNumber } from "@/lib/pagination/parsePageNumber";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const metadata = { title: "Maintenance" };

const PAGE_SIZE = 20;

type RequestRow = {
  id: string;
  title: string;
  urgency: string;
  status: MaintenanceStatus;
  created_at: string;
  tenant_confirmed_at: string | null;
  leases: {
    units: { label: string; properties: { name: string } };
  };
  submitted_by_profile: { full_name: string } | null;
};

/**
 * Every problem reported against every unit, filtered by state and urgency in the query.
 *
 * Urgent and still open is the combination a landlord opens this page for, so both filters live in
 * the URL and can be bookmarked together.
 */
export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; urgency?: string }>;
}) {
  const { page: pageParameter, status, urgency } = await searchParams;
  const page = parsePageNumber(pageParameter);
  const statusFilter = parseStatusFilter(status);
  const urgencyFilter = parseUrgencyFilter(urgency);
  const { startIndex, endIndex } = pageRange({ page, pageSize: PAGE_SIZE });

  const supabaseClient = await createSupabaseServerClient();
  let query = supabaseClient
    .from("maintenance_requests")
    .select(
      "id, title, urgency, status, created_at, tenant_confirmed_at, leases(units(label, properties(name))), submitted_by_profile:profiles!maintenance_requests_submitted_by_fkey(full_name)",
      { count: "exact" },
    );

  if (statusFilter === "open") {
    query = query.neq("status", "resolved");
  }
  if (statusFilter === "resolved") {
    query = query.eq("status", "resolved");
  }
  if (urgencyFilter !== "all") {
    query = query.eq("urgency", urgencyFilter);
  }

  const {
    data: requests,
    count,
    error,
  } = await query
    // Urgent first, then oldest, because an urgent problem reported three weeks ago is the one that
    // has been waiting longest for someone to look at it.
    .order("urgency", { ascending: false })
    .order("created_at", { ascending: true })
    .range(startIndex, endIndex);

  if (isPageBeyondTheEnd(error)) {
    redirect(buildHref({ status: statusFilter, urgency: urgencyFilter }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description="What your tenants have reported, and where each one has got to."
      />

      <MaintenanceFilters status={statusFilter} urgency={urgencyFilter} />

      <PaginatedTable
        caption="Maintenance requests across your units"
        columns={COLUMNS}
        rows={requests ?? []}
        rowKey={(row) => row.id}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={count ?? 0}
        basePath="/landlord/maintenance"
        currentQuery={{
          status: statusFilter === "all" ? undefined : statusFilter,
          urgency: urgencyFilter === "all" ? undefined : urgencyFilter,
        }}
        emptyState={emptyStateFor(statusFilter, urgencyFilter)}
      />
    </div>
  );
}

const COLUMNS: readonly TableColumn<RequestRow>[] = [
  {
    key: "title",
    header: "Problem",
    cell: (row) => (
      <Link href={`/landlord/maintenance/${row.id}`} className="font-medium underline">
        {row.title}
      </Link>
    ),
  },
  {
    key: "unit",
    header: "Unit",
    cell: (row) => `${row.leases.units.label} - ${row.leases.units.properties.name}`,
  },
  { key: "reported", header: "Reported", cell: (row) => row.created_at.slice(0, 10) },
  { key: "by", header: "By", cell: (row) => row.submitted_by_profile?.full_name ?? "" },
  { key: "urgency", header: "Urgency", cell: (row) => URGENCY_WORDS[row.urgency] ?? row.urgency },
  {
    key: "status",
    header: "Status",
    cell: (row) => (
      <div className="flex items-center gap-2">
        <MaintenanceStatusBadge status={row.status} />
        {row.tenant_confirmed_at === null ? null : (
          <span className="text-muted-foreground text-xs">confirmed</span>
        )}
      </div>
    ),
  },
];

function emptyStateFor(status: MaintenanceStatusFilter, urgency: MaintenanceUrgencyFilter) {
  if (status === "all" && urgency === "all") {
    return (
      <EmptyState
        title="Nothing reported"
        description="Problems your tenants report from their portal appear here, with a status you keep up to date. You cannot report one on their behalf."
      />
    );
  }

  return (
    <EmptyState
      title="Nothing matches these filters"
      description="Try a wider filter. Everything reported is still here."
      action={{ label: "Show everything", href: "/landlord/maintenance" }}
    />
  );
}
