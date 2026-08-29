import { describe, expect, it } from "vitest";

import { describeTenancyRentStatus } from "@/lib/rent/describeTenancyRentStatus";
import type { LeaseRentSummary } from "@/lib/rent/summariseOutstandingRent";

/**
 * The status column of the rent overview, which answers a different question from the one on a
 * single month. A month is paid or not; a whole tenancy may not have been charged anything yet.
 */
const SETTLED: LeaseRentSummary = {
  periodsPayableCount: 3,
  chargedToDateInAgorot: 1800000,
  paidInAgorot: 1800000,
  outstandingInAgorot: 0,
  overduePeriodCount: 0,
  earliestOverdueDueDate: null,
};

const NOTHING_CHARGED: LeaseRentSummary = {
  periodsPayableCount: 0,
  chargedToDateInAgorot: 0,
  paidInAgorot: 0,
  outstandingInAgorot: 0,
  overduePeriodCount: 0,
  earliestOverdueDueDate: null,
};

describe("describeTenancyRentStatus", () => {
  it("reads as overdue when any month is past its due date and unpaid", () => {
    expect(
      describeTenancyRentStatus({
        summary: { ...SETTLED, outstandingInAgorot: 650000, overduePeriodCount: 1, earliestOverdueDueDate: "2026-07-10" },
        lifecycle: "active",
      }),
    ).toEqual({ kind: "rent", status: "overdue" });
  });

  it("reads as part paid when something is owed but nothing is late yet", () => {
    expect(
      describeTenancyRentStatus({
        summary: { ...SETTLED, outstandingInAgorot: 400000 },
        lifecycle: "active",
      }),
    ).toEqual({ kind: "rent", status: "partial" });
  });

  // CORE-21
  it("reads as paid when everything charged has been paid", () => {
    expect(describeTenancyRentStatus({ summary: SETTLED, lifecycle: "active" })).toEqual({
      kind: "rent",
      status: "paid",
    });
  });

  /**
   * CORE-28, the case this function exists for. A tenancy that starts next month has been charged
   * nothing, so "paid" would claim a settlement that never happened, and the tenancy list calls the
   * same row Upcoming. Two screens must not disagree about one row.
   */
  it("does not call a tenancy paid when it has never been charged", () => {
    const status = describeTenancyRentStatus({ summary: NOTHING_CHARGED, lifecycle: "upcoming" });

    expect(status).toEqual({ kind: "notYetCharged", lifecycle: "upcoming" });
  });

  // CORE-28
  it("says the same about a tenancy that has started but whose first rent is not due yet", () => {
    expect(describeTenancyRentStatus({ summary: NOTHING_CHARGED, lifecycle: "active" })).toEqual({
      kind: "notYetCharged",
      lifecycle: "active",
    });
  });

  // CORE-28
  it("says the same about a tenancy that ended without ever being charged", () => {
    expect(describeTenancyRentStatus({ summary: NOTHING_CHARGED, lifecycle: "ended" })).toEqual({
      kind: "notYetCharged",
      lifecycle: "ended",
    });
  });

  /**
   * Being in credit is not the same as never having been charged: rent fell due and more than it
   * arrived, which is a settled tenancy and reads as paid.
   */
  it("still reads as paid for a tenancy that has paid ahead", () => {
    expect(
      describeTenancyRentStatus({
        summary: { ...SETTLED, paidInAgorot: 2400000, outstandingInAgorot: -600000 },
        lifecycle: "active",
      }),
    ).toEqual({ kind: "rent", status: "paid" });
  });

  it("prefers overdue over everything else, even with nothing charged recorded wrongly", () => {
    expect(
      describeTenancyRentStatus({
        summary: { ...NOTHING_CHARGED, overduePeriodCount: 1, outstandingInAgorot: 650000 },
        lifecycle: "active",
      }),
    ).toEqual({ kind: "rent", status: "overdue" });
  });
});
