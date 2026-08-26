/**
 * @vitest-environment jsdom
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/shared/EmptyState";
import { PaginatedTable, type TableColumn } from "@/components/shared/PaginatedTable";

type Payment = { id: string; month: string; amount: string };

const COLUMNS: readonly TableColumn<Payment>[] = [
  { key: "month", header: "For the month of", cell: (row) => row.month },
  { key: "amount", header: "Amount", alignment: "right", cell: (row) => row.amount },
];

const PAYMENTS: Payment[] = [
  { id: "one", month: "2026-08", amount: "₪6,500.00" },
  { id: "two", month: "2026-07", amount: "₪6,500.00" },
];

function renderTable(overrides: Partial<Parameters<typeof PaginatedTable<Payment>>[0]> = {}) {
  return render(
    <PaginatedTable
      caption="Payments recorded against this tenancy"
      columns={COLUMNS}
      rows={PAYMENTS}
      rowKey={(row) => row.id}
      page={1}
      pageSize={10}
      totalCount={2}
      basePath="/tenant/payments"
      emptyState={<EmptyState title="Nothing recorded yet" description="It will appear here." />}
      {...overrides}
    />,
  );
}

describe("PaginatedTable", () => {
  it("renders a header for every column and a row for every record", () => {
    renderTable();

    expect(screen.getByRole("columnheader", { name: "For the month of" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Amount" })).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByRole("cell", { name: "2026-08" })).toBeVisible();
  });

  it("says which rows of how many are being shown", () => {
    renderTable({ rows: PAYMENTS, totalCount: 57, pageSize: 10, page: 1 });

    expect(screen.getByText(/Showing 1 to 10 of 57/)).toBeVisible();
    expect(screen.getByText(/Page 1 of 6/)).toBeVisible();
  });

  it("offers a way forward but not back on the first page", () => {
    renderTable({ totalCount: 57, pageSize: 10, page: 1 });

    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/tenant/payments?page=2",
    );
    expect(screen.queryByRole("link", { name: "Previous" })).toBeNull();
    expect(screen.getByText("Previous")).toBeVisible();
  });

  it("offers a way back but not forward on the last page", () => {
    renderTable({ totalCount: 25, pageSize: 10, page: 3 });

    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/tenant/payments?page=2",
    );
    expect(screen.queryByRole("link", { name: "Next" })).toBeNull();
  });

  it("drops the page number rather than writing page one into the address", () => {
    renderTable({ totalCount: 25, pageSize: 10, page: 2 });

    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/tenant/payments",
    );
  });

  // UI-06: losing the filter on page two would make the filter pointless.
  it("carries the current filter into the page links", () => {
    renderTable({
      totalCount: 57,
      pageSize: 10,
      page: 1,
      basePath: "/landlord/maintenance",
      currentQuery: { status: "open", urgency: "urgent" },
    });

    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/landlord/maintenance?status=open&urgency=urgent&page=2",
    );
  });

  // UI-04
  it("shows the empty state instead of an empty table when there is nothing to list", () => {
    renderTable({ rows: [], totalCount: 0 });

    expect(screen.getByText("Nothing recorded yet")).toBeVisible();
    expect(screen.queryByRole("table")).toBeNull();
  });

  /**
   * A list that is not empty but whose current page is says so, rather than claiming the whole list
   * is empty. It happens when rows are removed while someone is looking at the last page.
   */
  it("explains an empty page of a list that is not empty", () => {
    renderTable({ rows: [], totalCount: 57, page: 9 });

    expect(screen.getByText(/nothing on this page any more/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to the first page" })).toHaveAttribute(
      "href",
      "/tenant/payments",
    );
  });

  it("names the table for a reader who cannot see it", () => {
    renderTable();

    expect(
      within(screen.getByRole("table")).getByText("Payments recorded against this tenancy"),
    ).toBeInTheDocument();
  });
});
