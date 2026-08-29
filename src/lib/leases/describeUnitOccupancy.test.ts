import { describe, expect, it } from "vitest";

import { describeUnitOccupancy, occupancyWords } from "@/lib/leases/describeUnitOccupancy";

const TODAY = "2026-05-01";

describe("describeUnitOccupancy", () => {
  it("calls a unit with no tenancies vacant", () => {
    expect(describeUnitOccupancy([], TODAY)).toEqual({ state: "vacant" });
  });

  it("calls a unit whose tenancies have all ended vacant", () => {
    const occupancy = describeUnitOccupancy(
      [{ startDate: "2020-01-01", endDate: "2020-12-31", tenantName: "Shira Mizrahi" }],
      TODAY,
    );

    expect(occupancy).toEqual({ state: "vacant" });
  });

  it("names the tenant living there and the day they leave", () => {
    const occupancy = describeUnitOccupancy(
      [{ startDate: "2026-01-01", endDate: "2026-12-31", tenantName: "Maya Levi" }],
      TODAY,
    );

    expect(occupancy).toEqual({
      state: "occupied",
      tenantName: "Maya Levi",
      endDate: "2026-12-31",
    });
  });

  it("calls a unit reserved when its only tenancy has not started yet", () => {
    const occupancy = describeUnitOccupancy(
      [{ startDate: "2026-09-01", endDate: "2027-08-31", tenantName: null }],
      TODAY,
    );

    expect(occupancy).toEqual({ state: "reserved", startDate: "2026-09-01" });
  });

  it("names the soonest tenancy when several are still to come", () => {
    const occupancy = describeUnitOccupancy(
      [
        { startDate: "2027-01-01", endDate: "2027-12-31", tenantName: null },
        { startDate: "2026-09-01", endDate: "2026-12-31", tenantName: null },
      ],
      TODAY,
    );

    expect(occupancy).toEqual({ state: "reserved", startDate: "2026-09-01" });
  });

  it("prefers the tenancy running today over one that is still to come", () => {
    const occupancy = describeUnitOccupancy(
      [
        { startDate: "2026-09-01", endDate: "2027-08-31", tenantName: null },
        { startDate: "2026-01-01", endDate: "2026-08-31", tenantName: "Maya Levi" },
      ],
      TODAY,
    );

    expect(occupancy.state).toBe("occupied");
  });
});

describe("occupancyWords", () => {
  it("says who is living there and until when", () => {
    expect(
      occupancyWords({ state: "occupied", tenantName: "Maya Levi", endDate: "2026-12-31" }),
    ).toBe("Maya Levi, until 2026-12-31");
  });

  // EDGE-18
  it("says a unit is let even when the tenant has no account yet", () => {
    expect(occupancyWords({ state: "occupied", tenantName: null, endDate: "2026-12-31" })).toBe(
      "Let until 2026-12-31, tenant account not created yet",
    );
  });

  it("says when a reserved unit starts", () => {
    expect(occupancyWords({ state: "reserved", startDate: "2026-09-01" })).toBe(
      "Let from 2026-09-01",
    );
  });

  it("says vacant plainly", () => {
    expect(occupancyWords({ state: "vacant" })).toBe("Vacant");
  });
});
