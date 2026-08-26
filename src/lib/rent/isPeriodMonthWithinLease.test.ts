import { describe, expect, it } from "vitest";

import {
  firstDayOfTheMonthOf,
  isPeriodMonthWithinLease,
} from "@/lib/rent/isPeriodMonthWithinLease";

const MID_MARCH_TO_MID_SEPTEMBER = {
  leaseStartDate: "2026-03-15",
  leaseEndDate: "2026-09-20",
};

describe("isPeriodMonthWithinLease", () => {
  it("accepts the month a tenancy starts in, even when it started mid month", () => {
    expect(
      isPeriodMonthWithinLease({ periodMonth: "2026-03-01", ...MID_MARCH_TO_MID_SEPTEMBER }),
    ).toBe(true);
  });

  it("accepts the month a tenancy ends in, even when it ended mid month", () => {
    expect(
      isPeriodMonthWithinLease({ periodMonth: "2026-09-01", ...MID_MARCH_TO_MID_SEPTEMBER }),
    ).toBe(true);
  });

  it("accepts a month in the middle of a tenancy", () => {
    expect(
      isPeriodMonthWithinLease({ periodMonth: "2026-06-01", ...MID_MARCH_TO_MID_SEPTEMBER }),
    ).toBe(true);
  });

  it("refuses the month before a tenancy began", () => {
    expect(
      isPeriodMonthWithinLease({ periodMonth: "2026-02-01", ...MID_MARCH_TO_MID_SEPTEMBER }),
    ).toBe(false);
  });

  it("refuses the month after a tenancy ended", () => {
    expect(
      isPeriodMonthWithinLease({ periodMonth: "2026-10-01", ...MID_MARCH_TO_MID_SEPTEMBER }),
    ).toBe(false);
  });

  it("refuses a period that is not a real date", () => {
    expect(() =>
      isPeriodMonthWithinLease({ periodMonth: "2026-02-30", ...MID_MARCH_TO_MID_SEPTEMBER }),
    ).toThrow(/calendar date/);
  });
});

describe("firstDayOfTheMonthOf", () => {
  it("reduces any date to the first of its month", () => {
    expect(firstDayOfTheMonthOf("2026-03-15")).toBe("2026-03-01");
    expect(firstDayOfTheMonthOf("2026-03-01")).toBe("2026-03-01");
  });
});
