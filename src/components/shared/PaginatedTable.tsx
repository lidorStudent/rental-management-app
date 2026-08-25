import Link from "next/link";
import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/classNames";
import { describePage } from "@/lib/pagination/describePage";

/**
 * The one table in this product. The rent ledger and the maintenance list are the same thing with
 * different columns, and a landlord with three years of payments needs both of them paged.
 *
 * It is a server component. The rows arrive already fetched and already paged by the page that
 * rendered it, and the controls are links rather than buttons, so the page number lives in the URL:
 * it can be shared, bookmarked, and read back by the server on the next request. Nothing about this
 * table needs the browser to fetch anything.
 */
export type TableColumn<TRow> = {
  key: string;
  header: string;
  alignment?: "left" | "right";
  cell: (row: TRow) => ReactNode;
};

export function PaginatedTable<TRow>({
  caption,
  columns,
  rows,
  rowKey,
  page,
  pageSize,
  totalCount,
  basePath,
  currentQuery,
  emptyState,
}: {
  caption: string;
  columns: readonly TableColumn<TRow>[];
  rows: readonly TRow[];
  rowKey: (row: TRow) => string;
  page: number;
  pageSize: number;
  totalCount: number;
  basePath: string;
  currentQuery?: Record<string, string | undefined>;
  emptyState: ReactNode;
}) {
  if (totalCount === 0) {
    return <>{emptyState}</>;
  }

  // The list is not empty but this page of it is, which happens when rows are removed while someone
  // is looking at the last page. Saying so beats an empty table with no explanation.
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border px-6 py-10 text-center text-sm">
        There is nothing on this page any more.{" "}
        <Link href={pageHref(basePath, currentQuery, 1)} className="underline">
          Back to the first page
        </Link>
      </p>
    );
  }

  const pageDescription = describePage({ page, pageSize, totalCount });

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(column.alignment === "right" && "text-right")}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(column.alignment === "right" && "text-right tabular-nums")}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>
          Showing {pageDescription.firstRowNumber} to {pageDescription.lastRowNumber} of{" "}
          {totalCount}
        </p>
        <div className="flex items-center gap-2">
          <PageLink
            href={pageHref(basePath, currentQuery, page - 1)}
            label="Previous"
            isAvailable={pageDescription.hasPreviousPage}
          />
          <span className="tabular-nums">
            Page {pageDescription.page} of {pageDescription.totalPages}
          </span>
          <PageLink
            href={pageHref(basePath, currentQuery, page + 1)}
            label="Next"
            isAvailable={pageDescription.hasNextPage}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * A control that leads nowhere is not a link. On the first and last page the word is still shown,
 * so the controls do not move about, but it is plain text rather than something to click.
 */
function PageLink({
  href,
  label,
  isAvailable,
}: {
  href: string;
  label: string;
  isAvailable: boolean;
}) {
  if (!isAvailable) {
    return <span className="rounded-md border px-3 py-1 opacity-50">{label}</span>;
  }

  return (
    <Link href={href} className="rounded-md border px-3 py-1 hover:bg-accent">
      {label}
    </Link>
  );
}

/** Keeps whatever filter the reader is looking at while moving between pages. */
function pageHref(
  basePath: string,
  currentQuery: Record<string, string | undefined> | undefined,
  page: number,
): string {
  const parameters = new URLSearchParams();

  for (const [name, value] of Object.entries(currentQuery ?? {})) {
    if (value !== undefined && name !== "page") {
      parameters.set(name, value);
    }
  }
  if (page > 1) {
    parameters.set("page", String(page));
  }

  const query = parameters.toString();
  return query === "" ? basePath : `${basePath}?${query}`;
}
