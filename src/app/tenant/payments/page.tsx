import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PaginatedTable, type TableColumn } from "@/components/shared/PaginatedTable";
import { PanelSkeleton } from "@/components/shared/PanelSkeleton";
import { TenantRentPosition } from "@/components/tenant/TenantRentPosition";
import { loadTenantLease } from "@/components/tenant/loadTenantLease";
import { formatCentsAsCurrency } from "@/lib/money/formatCentsAsCurrency";
import { pageRange } from "@/lib/pagination/describePage";
import { isPageBeyondTheEnd } from "@/lib/pagination/isPageBeyondTheEnd";
import { parsePageNumber } from "@/lib/pagination/parsePageNumber";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const metadata = { title: "Payments" };

const PAGE_SIZE = 20;

const PAYMENT_METHOD_WORDS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  cheque: "Cheque",
  card: "Card",
  other: "Other",
};

type PaymentRow = {
  id: string;
  period_month: string;
  amount_cents: number;
  received_on: string;
  method: string;
  reference: string | null;
};

const COLUMNS: readonly TableColumn<PaymentRow>[] = [
  { key: "period", header: "For the month of", cell: (row) => row.period_month.slice(0, 7) },
  {
    key: "amount",
    header: "Amount",
    alignment: "right",
    cell: (row) => formatCentsAsCurrency(row.amount_cents),
  },
  { key: "received", header: "Received on", cell: (row) => row.received_on },
  { key: "method", header: "How", cell: (row) => PAYMENT_METHOD_WORDS[row.method] ?? row.method },
  { key: "reference", header: "Reference", cell: (row) => row.reference ?? "" },
];

/**
 * Every payment the landlord has recorded against this tenant's lease, newest first and paged.
 *
 * The page number is read from the URL rather than held in the browser, so the server can fetch
 * exactly the rows this page shows. Row Level Security limits the query to the tenant's own lease,
 * so there is no owner filter here that could be left out by mistake.
 */
export default async function TenantPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParameter } = await searchParams;
  const page = parsePageNumber(pageParameter);
  const { startIndex, endIndex } = pageRange({ page, pageSize: PAGE_SIZE });

  const supabaseClient = await createSupabaseServerClient();

  // Independent: the payments query names no lease, because Row Level Security already scopes it to
  // the reader's own rows, and the tenancy is only needed for the heading and the empty state. They
  // go together rather than one after the other.
  const [lease, { data: payments, count, error }] = await Promise.all([
    loadTenantLease(),
    supabaseClient
      .from("rent_payments")
      .select("id, period_month, amount_cents, received_on, method, reference", { count: "exact" })
      .order("period_month", { ascending: false })
      .order("received_on", { ascending: false })
      .range(startIndex, endIndex),
  ]);

  // A page number past the end of the list is a bookmark that has gone stale, not an error.
  if (isPageBeyondTheEnd(error)) {
    redirect("/tenant/payments");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Payments"
          description="Everything your landlord has recorded as received from you."
        />
        <Link
          href="/tenant/statement"
          className="hover:bg-accent inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
        >
          Statement
        </Link>
      </div>

      {lease === null ? null : (
        <Suspense fallback={<PanelSkeleton lineCount={2} />}>
          <TenantRentPosition lease={lease} />
        </Suspense>
      )}

      <PaginatedTable
        caption="Rent payments recorded against your tenancy"
        columns={COLUMNS}
        rows={payments ?? []}
        rowKey={(row) => row.id}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={count ?? 0}
        basePath="/tenant/payments"
        emptyState={
          <EmptyState
            title="No payments recorded yet"
            description="Payments appear here once your landlord records them as received. They are not taken from your bank."
          />
        }
      />
    </div>
  );
}
