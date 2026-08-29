import { describe, expect, it } from "vitest";

import { describeTenancyRent, type TenancyRentRow } from "@/lib/rent/describeTenancyRent";

/**
 * The mapping the dashboard and the rent overview share. The arithmetic underneath it is tested in
 * summariseOutstandingRent and deriveRentStatus; what is tested here is the part this function
 * owns, which is what happens when the view hands back a null.
 */
const completeRow: TenancyRentRow = {
  lease_id: "lease-1",
  unit_label: "Flat 1",
  property_name: "Rothschild 12",
  tenant_full_name: "Maya Levi",
  start_date: "2026-01-01",
  end_date: "2026-12-31",
  rent_amount_cents: 650000,
  rent_due_day: 10,
  total_paid_cents: 650000,
};

describe("a complete row", () => {
  it("carries every field through and derives the lifecycle from the dates", () => {
    const tenancy = describeTenancyRent(completeRow, "2026-06-15");

    expect(tenancy.leaseId).toBe("lease-1");
    expect(tenancy.unitLabel).toBe("Flat 1");
    expect(tenancy.propertyName).toBe("Rothschild 12");
    expect(tenancy.tenantName).toBe("Maya Levi");
    expect(tenancy.lifecycle).toBe("active");
  });

  // CORE-21
  it("counts what has been paid against what was charged by that date", () => {
    const tenancy = describeTenancyRent(completeRow, "2026-02-15");

    expect(tenancy.summary.chargedToDateInAgorot).toBe(1300000);
    expect(tenancy.summary.paidInAgorot).toBe(650000);
    expect(tenancy.summary.outstandingInAgorot).toBe(650000);
  });

  it("reads a total that arrived as a string, which is how a bigint comes back", () => {
    const tenancy = describeTenancyRent(
      { ...completeRow, total_paid_cents: "1300000" as unknown as number },
      "2026-02-15",
    );

    expect(tenancy.summary.paidInAgorot).toBe(1300000);
  });
});

describe("a row with the nulls a view really produces", () => {
  /**
   * Only two of these columns can actually be null: the tenant's name, because the view left joins
   * to profiles and a tenancy can be recorded before the account exists, and the paid total, which
   * the view coalesces but the generated types still call nullable. The rest are not null in the
   * tables underneath, and the fallbacks in the mapper exist because the type generator cannot know
   * that, not because a row could arrive that way.
   */
  it("keeps a missing tenant name as null, because no account yet is a real state", () => {
    const tenancy = describeTenancyRent({ ...completeRow, tenant_full_name: null }, "2026-06-15");

    expect(tenancy.tenantName).toBeNull();
    expect(tenancy.unitLabel).toBe("Flat 1");
  });

  // CORE-21
  it("treats a tenancy with nothing paid as owing everything charged so far", () => {
    const tenancy = describeTenancyRent({ ...completeRow, total_paid_cents: null }, "2026-02-15");

    expect(tenancy.summary.paidInAgorot).toBe(0);
    expect(tenancy.summary.outstandingInAgorot).toBe(1300000);
    expect(tenancy.summary.overduePeriodCount).toBeGreaterThan(0);
  });
});
