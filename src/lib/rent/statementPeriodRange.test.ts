import { describe, expect, it } from "vitest";

import {
  chooseStatementRange,
  monthInputValue,
  monthOrNull,
} from "@/lib/rent/statementPeriodRange";

const LEASE = { leaseStartDate: "2026-01-15", leaseEndDate: "2026-12-20" };

describe("chooseStatementRange", () => {
  it("covers the tenancy up to today when nothing is asked for", () => {
    const range = chooseStatementRange({
      requestedFrom: undefined,
      requestedTo: undefined,
      ...LEASE,
      currentDate: "2026-05-04",
    });

    expect(range).toEqual({ fromMonth: "2026-01-01", toMonth: "2026-05-01" });
  });

  it("stops at the end of a tenancy that has already finished", () => {
    const range = chooseStatementRange({
      requestedFrom: undefined,
      requestedTo: undefined,
      ...LEASE,
      currentDate: "2027-05-04",
    });

    expect(range.toMonth).toBe("2026-12-01");
  });

  it("uses the months that were asked for", () => {
    const range = chooseStatementRange({
      requestedFrom: "2026-03",
      requestedTo: "2026-06",
      ...LEASE,
      currentDate: "2026-08-01",
    });

    expect(range).toEqual({ fromMonth: "2026-03-01", toMonth: "2026-06-01" });
  });

  it("clamps a range that reaches outside the tenancy", () => {
    const range = chooseStatementRange({
      requestedFrom: "2020-01",
      requestedTo: "2030-01",
      ...LEASE,
      currentDate: "2026-08-01",
    });

    expect(range).toEqual({ fromMonth: "2026-01-01", toMonth: "2026-12-01" });
  });

  it("reads a backwards range as a typo and turns it around", () => {
    const range = chooseStatementRange({
      requestedFrom: "2026-06",
      requestedTo: "2026-03",
      ...LEASE,
      currentDate: "2026-08-01",
    });

    expect(range).toEqual({ fromMonth: "2026-03-01", toMonth: "2026-06-01" });
  });

  // INV-52: a stale bookmark is not a fault.
  it("falls back to the default range when the months are not months", () => {
    const range = chooseStatementRange({
      requestedFrom: "not-a-month",
      requestedTo: "9999-99",
      ...LEASE,
      currentDate: "2026-05-04",
    });

    expect(range).toEqual({ fromMonth: "2026-01-01", toMonth: "2026-05-01" });
  });
});

describe("monthOrNull", () => {
  it("reads a month as the first day of it", () => {
    expect(monthOrNull("2026-03")).toBe("2026-03-01");
  });

  it("refuses anything that is not a month", () => {
    expect(monthOrNull(undefined)).toBeNull();
    expect(monthOrNull("2026")).toBeNull();
    expect(monthOrNull("2026-13")).toBeNull();
    expect(monthOrNull("March")).toBeNull();
  });
});

describe("monthInputValue", () => {
  it("writes a period month the way a month input expects it", () => {
    expect(monthInputValue("2026-03-01")).toBe("2026-03");
  });
});
