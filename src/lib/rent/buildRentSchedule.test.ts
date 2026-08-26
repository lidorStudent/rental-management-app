import { describe, expect, it } from "vitest";

import { buildRentScheduleWithStatus, buildRentSchedule } from "@/lib/rent/buildRentSchedule";

const YEAR_LONG_LEASE = {
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  rentAmountInAgorot: 650000,
  rentDueDay: 10,
};

describe("buildRentSchedule", () => {
  it("charges one period for every month a tenancy runs", () => {
    expect(buildRentSchedule(YEAR_LONG_LEASE)).toHaveLength(12);
  });

  it("names each period by the first day of its month and its due date", () => {
    const [firstPeriod] = buildRentSchedule(YEAR_LONG_LEASE);

    expect(firstPeriod).toEqual({
      periodMonth: "2026-01-01",
      dueDate: "2026-01-10",
      amountDueInAgorot: 650000,
    });
  });

  it("charges a part month in full, at both ends of a tenancy", () => {
    const periods = buildRentSchedule({
      ...YEAR_LONG_LEASE,
      startDate: "2026-03-15",
      endDate: "2026-09-20",
    });

    expect(periods).toHaveLength(7);
    expect(periods[0]?.periodMonth).toBe("2026-03-01");
    expect(periods[6]?.periodMonth).toBe("2026-09-01");
  });

  it("carries the schedule across a year boundary", () => {
    const periods = buildRentSchedule({
      ...YEAR_LONG_LEASE,
      startDate: "2026-11-01",
      endDate: "2027-02-28",
    });

    expect(periods.map((period) => period.periodMonth)).toEqual([
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
      "2027-02-01",
    ]);
  });

  // EDGE-13: the reason the due day is capped at 28.
  it("gives every month a due date, February included", () => {
    const periods = buildRentSchedule({
      startDate: "2027-01-01",
      endDate: "2027-03-31",
      rentAmountInAgorot: 650000,
      rentDueDay: 28,
    });

    expect(periods.map((period) => period.dueDate)).toEqual([
      "2027-01-28",
      "2027-02-28",
      "2027-03-28",
    ]);
  });

  it("refuses a due day February could not honour", () => {
    expect(() => buildRentSchedule({ ...YEAR_LONG_LEASE, rentDueDay: 31 })).toThrow(
      /between 1 and 28/,
    );
  });

  it("refuses a tenancy that ends before it starts", () => {
    expect(() =>
      buildRentSchedule({ ...YEAR_LONG_LEASE, startDate: "2026-12-01", endDate: "2026-01-01" }),
    ).toThrow(/must end after it starts/);
  });

  it("refuses a rent of nothing", () => {
    expect(() => buildRentSchedule({ ...YEAR_LONG_LEASE, rentAmountInAgorot: 0 })).toThrow(
      /positive amount/,
    );
  });
});

describe("buildRentScheduleWithStatus", () => {
  // EDGE-04: the outstanding amount is a figure, not only a word.
  it("shows what is left on a part paid month", () => {
    const periods = buildRentScheduleWithStatus({
      lease: YEAR_LONG_LEASE,
      paidByPeriodMonth: new Map([["2026-03-01", 250000]]),
      currentDate: "2026-03-05",
    });
    const march = periods.find((period) => period.periodMonth === "2026-03-01");

    expect(march?.status).toBe("partial");
    expect(march?.outstandingInAgorot).toBe(400000);
  });

  it("shows a month that has been overpaid as in credit", () => {
    const periods = buildRentScheduleWithStatus({
      lease: YEAR_LONG_LEASE,
      paidByPeriodMonth: new Map([["2026-03-01", 700000]]),
      currentDate: "2026-03-20",
    });
    const march = periods.find((period) => period.periodMonth === "2026-03-01");

    expect(march?.status).toBe("paid");
    expect(march?.outstandingInAgorot).toBe(-50000);
  });

  // EDGE-11: paying ahead is normal.
  it("marks a month paid in advance as paid without making it look late", () => {
    const periods = buildRentScheduleWithStatus({
      lease: YEAR_LONG_LEASE,
      paidByPeriodMonth: new Map([["2026-09-01", 650000]]),
      currentDate: "2026-03-05",
    });
    const september = periods.find((period) => period.periodMonth === "2026-09-01");

    expect(september?.status).toBe("paid");
  });

  it("treats a month with nothing recorded as owing the whole rent", () => {
    const periods = buildRentScheduleWithStatus({
      lease: YEAR_LONG_LEASE,
      paidByPeriodMonth: new Map(),
      currentDate: "2026-04-01",
    });
    const march = periods.find((period) => period.periodMonth === "2026-03-01");

    expect(march?.status).toBe("overdue");
    expect(march?.outstandingInAgorot).toBe(650000);
  });
});
