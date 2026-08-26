import { describe, expect, it } from "vitest";

import { findConflictingLease, type ExistingLease } from "@/lib/leases/findConflictingLease";

/**
 * Domain invariant 1, exhaustively. Both endpoint dates belong to the tenancy that owns them, which
 * is the rule the whole product turns on, so every arrangement of two date ranges is checked here.
 */
const THE_UNIT = "unit-rothschild-flat-1";

function existingLease(
  leaseId: string,
  startDate: string,
  endDate: string,
  unitId = THE_UNIT,
): ExistingLease {
  return { leaseId, unitId, startDate, endDate };
}

const januaryToMay = existingLease("january-to-may", "2026-01-01", "2026-05-31");

describe("findConflictingLease", () => {
  it("finds nothing when the unit has never been let", () => {
    expect(
      findConflictingLease(
        { unitId: THE_UNIT, startDate: "2026-01-01", endDate: "2026-12-31" },
        [],
      ),
    ).toBeNull();
  });

  it("allows a tenancy that ends before the existing one begins", () => {
    expect(
      findConflictingLease({ unitId: THE_UNIT, startDate: "2025-01-01", endDate: "2025-12-31" }, [
        januaryToMay,
      ]),
    ).toBeNull();
  });

  it("allows a tenancy that begins after the existing one ends", () => {
    expect(
      findConflictingLease({ unitId: THE_UNIT, startDate: "2026-07-01", endDate: "2026-12-31" }, [
        januaryToMay,
      ]),
    ).toBeNull();
  });

  // EDGE-01, EDGE-02: the boundary the product is built on.
  it("refuses a tenancy beginning on the day the existing one ends", () => {
    const conflict = findConflictingLease(
      { unitId: THE_UNIT, startDate: "2026-05-31", endDate: "2027-05-30" },
      [januaryToMay],
    );

    expect(conflict?.leaseId).toBe("january-to-may");
  });

  it("allows a tenancy beginning the day after the existing one ends", () => {
    expect(
      findConflictingLease({ unitId: THE_UNIT, startDate: "2026-06-01", endDate: "2027-05-31" }, [
        januaryToMay,
      ]),
    ).toBeNull();
  });

  it("refuses a tenancy ending on the day the existing one begins", () => {
    const conflict = findConflictingLease(
      { unitId: THE_UNIT, startDate: "2025-06-01", endDate: "2026-01-01" },
      [januaryToMay],
    );

    expect(conflict?.leaseId).toBe("january-to-may");
  });

  it("allows a tenancy ending the day before the existing one begins", () => {
    expect(
      findConflictingLease({ unitId: THE_UNIT, startDate: "2025-06-01", endDate: "2025-12-31" }, [
        januaryToMay,
      ]),
    ).toBeNull();
  });

  it("refuses a tenancy with exactly the same dates", () => {
    const conflict = findConflictingLease(
      { unitId: THE_UNIT, startDate: "2026-01-01", endDate: "2026-05-31" },
      [januaryToMay],
    );

    expect(conflict?.leaseId).toBe("january-to-may");
  });

  it("refuses a tenancy that falls entirely inside the existing one", () => {
    const conflict = findConflictingLease(
      { unitId: THE_UNIT, startDate: "2026-02-01", endDate: "2026-03-01" },
      [januaryToMay],
    );

    expect(conflict?.leaseId).toBe("january-to-may");
  });

  it("refuses a tenancy that swallows the existing one", () => {
    const conflict = findConflictingLease(
      { unitId: THE_UNIT, startDate: "2025-01-01", endDate: "2027-01-01" },
      [januaryToMay],
    );

    expect(conflict?.leaseId).toBe("january-to-may");
  });

  it("refuses a tenancy that overlaps the beginning of the existing one", () => {
    const conflict = findConflictingLease(
      { unitId: THE_UNIT, startDate: "2025-11-01", endDate: "2026-02-01" },
      [januaryToMay],
    );

    expect(conflict?.leaseId).toBe("january-to-may");
  });

  it("refuses a tenancy that overlaps the end of the existing one", () => {
    const conflict = findConflictingLease(
      { unitId: THE_UNIT, startDate: "2026-05-01", endDate: "2026-08-01" },
      [januaryToMay],
    );

    expect(conflict?.leaseId).toBe("january-to-may");
  });

  // EDGE-03: without this, no lease could ever be edited.
  it("does not report a tenancy as conflicting with itself when it is being edited", () => {
    expect(
      findConflictingLease(
        {
          unitId: THE_UNIT,
          startDate: "2026-01-01",
          endDate: "2026-06-30",
          leaseIdBeingEdited: "january-to-may",
        },
        [januaryToMay],
      ),
    ).toBeNull();
  });

  it("still reports a different tenancy when one is being edited", () => {
    const julyToDecember = existingLease("july-to-december", "2026-07-01", "2026-12-31");

    const conflict = findConflictingLease(
      {
        unitId: THE_UNIT,
        startDate: "2026-01-01",
        endDate: "2026-08-01",
        leaseIdBeingEdited: "january-to-may",
      },
      [januaryToMay, julyToDecember],
    );

    expect(conflict?.leaseId).toBe("july-to-december");
  });

  it("ignores tenancies on other units", () => {
    expect(
      findConflictingLease(
        { unitId: "unit-somewhere-else", startDate: "2026-01-01", endDate: "2026-12-31" },
        [januaryToMay],
      ),
    ).toBeNull();
  });

  /**
   * A lease has no status in this product: its dates are its lifecycle. A tenancy that finished
   * years ago still owns the dates it ran for, because recording a new one over them would produce
   * a ledger claiming two tenants owed rent for the same flat in the same month.
   */
  it("counts a tenancy that has already ended", () => {
    const longFinished = existingLease("long-finished", "2020-01-01", "2020-12-31");

    const conflict = findConflictingLease(
      { unitId: THE_UNIT, startDate: "2020-06-01", endDate: "2021-06-01" },
      [longFinished],
    );

    expect(conflict?.leaseId).toBe("long-finished");
  });

  it("counts a tenancy that has not started yet", () => {
    const nextYear = existingLease("next-year", "2027-01-01", "2027-12-31");

    const conflict = findConflictingLease(
      { unitId: THE_UNIT, startDate: "2026-06-01", endDate: "2027-06-01" },
      [nextYear],
    );

    expect(conflict?.leaseId).toBe("next-year");
  });

  it("names the earliest conflicting tenancy when several overlap", () => {
    const laterOne = existingLease("later-one", "2026-04-01", "2026-09-30");

    const conflict = findConflictingLease(
      { unitId: THE_UNIT, startDate: "2026-01-15", endDate: "2026-12-31" },
      [laterOne, januaryToMay],
    );

    expect(conflict?.leaseId).toBe("january-to-may");
  });

  it("refuses to judge a proposal that ends before it starts", () => {
    expect(() =>
      findConflictingLease(
        { unitId: THE_UNIT, startDate: "2026-05-31", endDate: "2026-01-01" },
        [],
      ),
    ).toThrow(/must end after it starts/);
  });

  it("refuses to judge a proposal whose dates are not real dates", () => {
    expect(() =>
      findConflictingLease(
        { unitId: THE_UNIT, startDate: "2026-02-30", endDate: "2026-12-31" },
        [],
      ),
    ).toThrow(/calendar date/);
  });
});
