import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PaginatedTable, type TableColumn } from "@/components/shared/PaginatedTable";
import { pageRange } from "@/lib/pagination/describePage";
import { isPageBeyondTheEnd } from "@/lib/pagination/isPageBeyondTheEnd";
import { parsePageNumber } from "@/lib/pagination/parsePageNumber";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const metadata = { title: "Problems" };

const PAGE_SIZE = 20;

const STATUS_WORDS: Record<string, string> = {
  submitted: "Reported",
  acknowledged: "Seen by your landlord",
  in_progress: "Being worked on",
  resolved: "Resolved",
};

const URGENCY_WORDS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  urgent: "Urgent",
};

type RequestRow = {
  id: string;
  title: string;
  urgency: string;
  status: string;
  created_at: string;
  tenant_confirmed_at: string | null;
};

const COLUMNS: readonly TableColumn<RequestRow>[] = [
  {
    key: "title",
    header: "Problem",
    cell: (row) => (
      <Link href={`/tenant/maintenance/${row.id}`} className="font-medium underline">
        {row.title}
      </Link>
    ),
  },
  { key: "reported", header: "Reported", cell: (row) => row.created_at.slice(0, 10) },
  { key: "urgency", header: "Urgency", cell: (row) => URGENCY_WORDS[row.urgency] ?? row.urgency },
  {
    key: "status",
    header: "Status",
    cell: (row) =>
      row.tenant_confirmed_at === null
        ? (STATUS_WORDS[row.status] ?? row.status)
        : "Resolved, confirmed by you",
  },
];

/**
 * The same paginated table as the payment history, with different columns. That is the whole reason
 * it takes its columns as data: a landlord's maintenance list is this list with a tenant name added.
 */
export default async function TenantMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParameter } = await searchParams;
  const page = parsePageNumber(pageParameter);
  const { startIndex, endIndex } = pageRange({ page, pageSize: PAGE_SIZE });

  const supabaseClient = await createSupabaseServerClient();
  const {
    data: requests,
    count,
    error,
  } = await supabaseClient
    .from("maintenance_requests")
    .select("id, title, urgency, status, created_at, tenant_confirmed_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(startIndex, endIndex);

  // A page number past the end of the list is a bookmark that has gone stale, not an error.
  if (isPageBeyondTheEnd(error)) {
    redirect("/tenant/maintenance");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Problems"
          description="What you have reported, and where each one has got to."
        />
        <Link
          href="/tenant/maintenance/new"
          className="hover:bg-accent inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
        >
          Report a problem
        </Link>
      </div>

      <PaginatedTable
        caption="Maintenance requests you have reported"
        columns={COLUMNS}
        rows={requests ?? []}
        rowKey={(row) => row.id}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={count ?? 0}
        basePath="/tenant/maintenance"
        emptyState={
          <EmptyState
            title="Nothing reported"
            description="Report a problem with your home here and your landlord sees it straight away, with its status kept up to date."
            action={{ label: "Report a problem", href: "/tenant/maintenance/new" }}
          />
        }
      />
    </div>
  );
}
