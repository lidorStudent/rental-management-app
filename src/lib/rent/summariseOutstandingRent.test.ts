import { describe, expect, it } from "vitest";

import {
  summariseLeaseRentFromTotal,
  totalArrearsInAgorot,
} from "@/lib/rent/summariseOutstandingRent";

const LEASE = {
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  rentAmountInAgorot: 650000,
  rentDueDay: 10,
};

function summaryOn(currentDate: string, totalPaidInAgorot: number) {
  return summariseLeaseRentFromTotal({ lease: LEASE, totalPaidInAgorot, currentDate });
}

describe("summariseLeaseRentFromTotal", () => {
  it("charges nothing before the first rent falls due", () => {
    const summary = summaryOn("2026-01-05", 0);

    expect(summary.periodsPayableCount).toBe(0);
    expect(summary.chargedToDateInAgorot).toBe(0);
    expect(summary.outstandingInAgorot).toBe(0);
  });

  it("charges each month once its due date has arrived", () => {
    const summary = summaryOn("2026-03-10", 0);

    expect(summary.periodsPayableCount).toBe(3);
    expect(summary.chargedToDateInAgorot).toBe(1950000);
  });

  it("counts nothing as overdue when everything charged has been paid", () => {
    const summary = summaryOn("2026-03-10", 1950000);

    expect(summary.outstandingInAgorot).toBe(0);
    expect(summary.overduePeriodCount).toBe(0);
  });

  // PROC-11
  it("counts the months that are past their due date and unpaid", () => {
    const summary = summaryOn("2026-03-11", 650000);

    expect(summary.overduePeriodCount).toBe(2);
    expect(summary.earliestOverdueDueDate).toBe("2026-02-10");
    expect(summary.outstandingInAgorot).toBe(1300000);
  });

  /**
   * A total is applied to the oldest month first, which is what a ledger does anyway: money that
   * arrives settles the oldest arrears. Half of one month leaves that month short, not the last.
   */
  // EDGE-17
  it("settles the oldest month first when only a total is known", () => {
    const summary = summaryOn("2026-03-11", 975000);

    expect(summary.overduePeriodCount).toBe(2);
    expect(summary.earliestOverdueDueDate).toBe("2026-02-10");
  });

  it("reports a tenant who has paid ahead as being in credit", () => {
    const summary = summaryOn("2026-03-10", 2600000);

    expect(summary.outstandingInAgorot).toBe(-650000);
    expect(summary.overduePeriodCount).toBe(0);
  });

  it("stops charging once a tenancy has ended", () => {
    const summary = summariseLeaseRentFromTotal({
      lease: { ...LEASE, endDate: "2026-06-30" },
      totalPaidInAgorot: 0,
      currentDate: "2027-06-01",
    });

    expect(summary.periodsPayableCount).toBe(6);
  });

  it("refuses payments that total a negative amount", () => {
    expect(() => summaryOn("2026-03-10", -1)).toThrow(/negative/);
  });
});

describe("totalArrearsInAgorot", () => {
  it("adds up what is owed", () => {
    const owing = summaryOn("2026-03-11", 0);
    const alsoOwing = summaryOn("2026-02-11", 0);

    expect(totalArrearsInAgorot([owing, alsoOwing])).toBe(
      owing.outstandingInAgorot + alsoOwing.outstandingInAgorot,
    );
  });

  /**
   * One tenant paying next month early does not reduce what a different tenant owes, and a headline
   * figure that pretended otherwise would be the wrong number to act on.
   */
  it("does not let one tenancy's credit cancel another's arrears", () => {
    const owing = summaryOn("2026-03-11", 0);
    const inCredit = summaryOn("2026-03-10", 2600000);

    expect(totalArrearsInAgorot([owing, inCredit])).toBe(owing.outstandingInAgorot);
  });

  it("adds up to nothing when every tenancy is settled", () => {
    expect(totalArrearsInAgorot([summaryOn("2026-03-10", 1950000)])).toBe(0);
  });
});
