import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/shared/EmptyState";
import { PaginatedTable, type TableColumn } from "@/components/shared/PaginatedTable";
import { formatCentsAsCurrency } from "@/lib/money/formatCentsAsCurrency";
import { pageRange } from "@/lib/pagination/describePage";
import { isPageBeyondTheEnd } from "@/lib/pagination/isPageBeyondTheEnd";
import { parsePageNumber } from "@/lib/pagination/parsePageNumber";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

const PAGE_SIZE = 10;

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

/**
 * Every payment recorded against one tenancy, most recent first, a page at a time. This is the only
 * place the payment rows themselves are read; the schedule above it works from an aggregate.
 */
export async function LeasePaymentHistory({
  leaseId,
  page: pageParameter,
}: {
  leaseId: string;
  page: string | undefined;
}) {
  const page = parsePageNumber(pageParameter);
  const { startIndex, endIndex } = pageRange({ page, pageSize: PAGE_SIZE });

  const supabaseClient = await createSupabaseServerClient();
  const {
    data: payments,
    count,
    error,
  } = await supabaseClient
    .from("rent_payments")
    .select("id, period_month, amount_cents, received_on, method, reference", { count: "exact" })
    .eq("lease_id", leaseId)
    .order("received_on", { ascending: false })
    .order("created_at", { ascending: false })
    .range(startIndex, endIndex);

  // A page number past the end of the list is a bookmark that has gone stale, not an error.
  if (isPageBeyondTheEnd(error)) {
    redirect(`/landlord/leases/${leaseId}`);
  }

  return (
    <PaginatedTable
      caption="Payments recorded against this tenancy"
      columns={buildColumns(leaseId)}
      rows={payments ?? []}
      rowKey={(row) => row.id}
      page={page}
      pageSize={PAGE_SIZE}
      totalCount={count ?? 0}
      basePath={`/landlord/leases/${leaseId}`}
      emptyState={
        <EmptyState
          title="Nothing recorded yet"
          description="Record what has arrived and the schedule above works itself out. This product records money received; it does not collect it."
          action={{
            label: "Record a payment",
            href: `/landlord/leases/${leaseId}/payments/new`,
          }}
        />
      }
    />
  );
}

function buildColumns(leaseId: string): readonly TableColumn<PaymentRow>[] {
  return [
    { key: "received", header: "Received on", cell: (row) => row.received_on },
    { key: "period", header: "For", cell: (row) => row.period_month.slice(0, 7) },
    {
      key: "amount",
      header: "Amount",
      alignment: "right",
      cell: (row) => formatCentsAsCurrency(row.amount_cents),
    },
    { key: "method", header: "How", cell: (row) => PAYMENT_METHOD_WORDS[row.method] ?? row.method },
    { key: "reference", header: "Reference", cell: (row) => row.reference ?? "" },
    {
      key: "correct",
      header: "",
      alignment: "right",
      cell: (row) => (
        <Link
          href={`/landlord/leases/${leaseId}/payments/${row.id}/edit`}
          aria-label={`Correct the payment received on ${row.received_on}`}
          className="text-sm underline"
        >
          Correct
        </Link>
      ),
    },
  ];
}
