import { describe, expect, it } from "vitest";

import {
  chooseCurrentLease,
  describeLeaseLifecycle,
  findActiveLease,
} from "@/lib/leases/describeLeaseLifecycle";

const MARCH_TO_SEPTEMBER = { startDate: "2026-03-01", endDate: "2026-09-30" };

describe("describeLeaseLifecycle", () => {
  it("calls a tenancy upcoming before its first day", () => {
    expect(describeLeaseLifecycle({ ...MARCH_TO_SEPTEMBER, currentDate: "2026-02-28" })).toBe(
      "upcoming",
    );
  });

  // EDGE-06
  it("calls a tenancy active on the day it starts", () => {
    expect(describeLeaseLifecycle({ ...MARCH_TO_SEPTEMBER, currentDate: "2026-03-01" })).toBe(
      "active",
    );
  });

  // EDGE-05: the last day belongs to the tenant, exactly as the overlap rule says it does.
  it("calls a tenancy active on the day it ends", () => {
    expect(describeLeaseLifecycle({ ...MARCH_TO_SEPTEMBER, currentDate: "2026-09-30" })).toBe(
      "active",
    );
  });

  it("calls a tenancy ended on the day after its last day", () => {
    expect(describeLeaseLifecycle({ ...MARCH_TO_SEPTEMBER, currentDate: "2026-10-01" })).toBe(
      "ended",
    );
  });

  it("refuses dates that are not real dates", () => {
    expect(() =>
      describeLeaseLifecycle({
        startDate: "2026-02-30",
        endDate: "2026-09-30",
        currentDate: "2026-03-01",
      }),
    ).toThrow(/calendar date/);
  });
});

describe("findActiveLease", () => {
  it("finds nothing when a tenant has no tenancies at all", () => {
    expect(findActiveLease([], "2026-03-01")).toBeNull();
  });

  it("finds nothing when every tenancy has ended", () => {
    expect(
      findActiveLease([{ startDate: "2020-01-01", endDate: "2020-12-31" }], "2026-03-01"),
    ).toBeNull();
  });

  it("finds the tenancy that is running today", () => {
    const active = findActiveLease(
      [{ startDate: "2020-01-01", endDate: "2020-12-31" }, MARCH_TO_SEPTEMBER],
      "2026-05-01",
    );

    expect(active).toEqual(MARCH_TO_SEPTEMBER);
  });

  it("prefers the most recently started tenancy when a tenant somehow has two running", () => {
    const newer = { startDate: "2026-04-01", endDate: "2026-12-31" };

    expect(findActiveLease([MARCH_TO_SEPTEMBER, newer], "2026-05-01")).toEqual(newer);
  });
});

describe("chooseCurrentLease", () => {
  it("shows the running tenancy when there is one", () => {
    const ended = { startDate: "2020-01-01", endDate: "2020-12-31" };

    expect(chooseCurrentLease([ended, MARCH_TO_SEPTEMBER], "2026-05-01")).toEqual(
      MARCH_TO_SEPTEMBER,
    );
  });

  it("shows the tenancy about to start when none is running", () => {
    const soon = { startDate: "2026-07-01", endDate: "2027-06-30" };
    const later = { startDate: "2027-07-01", endDate: "2028-06-30" };

    expect(chooseCurrentLease([later, soon], "2026-05-01")).toEqual(soon);
  });

  it("shows the tenancy that ended most recently when none is running or upcoming", () => {
    const older = { startDate: "2019-01-01", endDate: "2019-12-31" };
    const newer = { startDate: "2020-01-01", endDate: "2020-12-31" };

    expect(chooseCurrentLease([older, newer], "2026-05-01")).toEqual(newer);
  });

  it("shows nothing for an account with no tenancy", () => {
    expect(chooseCurrentLease([], "2026-05-01")).toBeNull();
  });
});
