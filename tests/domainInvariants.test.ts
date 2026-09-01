import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  SEEDED_IDS,
  SEEDED_USERS,
  profileIdFor,
  required,
  serviceRoleClient,
  signInAs,
  untypedServiceRoleClient,
} from "./support/testDatabase";

/**
 * One test per domain invariant, each written so that it fails if the invariant is broken.
 *
 * The five are stated in CLAUDE.md and repeated at the top of the policy migration. They are the
 * promises the product makes; everything else is a feature. The permission suites cover invariants
 * three, four and five in detail, and this file exists so that each of the five can be pointed at
 * directly when someone asks which test would catch it.
 */
let noaProfileId: string;
const leasesToRemove: string[] = [];

beforeAll(async () => {
  noaProfileId = await profileIdFor(SEEDED_USERS.landlordNoa);
});

afterAll(async () => {
  if (leasesToRemove.length > 0) {
    await serviceRoleClient().from("leases").delete().in("id", leasesToRemove);
  }
});

/**
 * Invariant 1: a unit can never have two overlapping active leases.
 *
 * The attempt is made with the service role, which bypasses Row Level Security and every check the
 * application makes. If this ever passes, the guarantee is not in the database and the product's
 * headline rule rests on remembering to call a function.
 */
describe("invariant 1: a unit is never let twice over the same dates", () => {
  // DB-01
  it("refuses an overlapping tenancy even with every application check bypassed", async () => {
    const { error } = await serviceRoleClient().from("leases").insert({
      unit_id: SEEDED_IDS.unitRothschildOne,
      landlord_id: noaProfileId,
      rent_amount_cents: 100000,
      start_date: "2026-06-01",
      end_date: "2026-07-31",
      rent_due_day: 1,
    });

    expect(error?.code).toBe("23P01");
  });

  // DB-02
  it("refuses a tenancy beginning on the day the existing one ends", async () => {
    const service = serviceRoleClient();
    const { data: existing } = await service
      .from("leases")
      .select("end_date")
      .eq("id", SEEDED_IDS.leaseMayaActive)
      .single();

    const { error } = await service.from("leases").insert({
      unit_id: SEEDED_IDS.unitRothschildOne,
      landlord_id: noaProfileId,
      rent_amount_cents: 100000,
      start_date: required(existing, "Maya's tenancy").end_date,
      end_date: "2028-12-31",
      rent_due_day: 1,
    });

    expect(error?.code).toBe("23P01");
  });

  // DB-03
  it("allows a tenancy beginning the day after, so the rule is a boundary and not a wall", async () => {
    const service = serviceRoleClient();
    const { data: created, error } = await service
      .from("leases")
      .insert({
        unit_id: SEEDED_IDS.unitRothschildOne,
        landlord_id: noaProfileId,
        rent_amount_cents: 100000,
        start_date: "2027-01-01",
        end_date: "2027-12-31",
        rent_due_day: 1,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    leasesToRemove.push(required(created, "the tenancy just created").id);
  });
});

/**
 * Invariant 2: rent status is always derived, never typed in.
 *
 * It holds because there is nowhere to write one. The test asks the database to store a status and
 * is told the column does not exist, which is exactly what would stop being true if somebody added
 * one.
 */
describe("invariant 2: rent status is derived, never stored", () => {
  it("has no rent status column to read", async () => {
    const { error } = await untypedServiceRoleClient().from("rent_payments").select("status");

    expect(error?.code).toBe("42703");
    expect(error?.message).toMatch(/status/);
  });

  it("has no rent status column to write", async () => {
    const { error } = await untypedServiceRoleClient().from("rent_payments").insert({
      lease_id: SEEDED_IDS.leaseMayaActive,
      landlord_id: noaProfileId,
      recorded_by: noaProfileId,
      period_month: "2026-08-01",
      amount_cents: 1,
      received_on: "2026-08-01",
      method: "cash",
      status: "paid",
    });

    expect(error?.code).toBe("PGRST204");
    expect(error?.message).toMatch(/status/);
  });

  it("has no status column on a tenancy either, so a lifecycle cannot be stored", async () => {
    const { error } = await untypedServiceRoleClient().from("leases").select("status");

    expect(error?.code).toBe("42703");
  });
});

/** Invariant 3: a tenant can only ever read or write rows that belong to their own lease. */
describe("invariant 3: a tenant reaches only their own tenancy", () => {
  it("returns nothing when a tenant names another tenant's tenancy", async () => {
    const maya = await signInAs(SEEDED_USERS.tenantMaya);

    const { data } = await maya.from("leases").select("id").eq("id", SEEDED_IDS.leaseYonatanActive);

    expect(data).toEqual([]);
  });

  it("refuses a problem reported against another tenant's tenancy", async () => {
    const maya = await signInAs(SEEDED_USERS.tenantMaya);
    const mayaProfileId = await profileIdFor(SEEDED_USERS.tenantMaya);

    const { error } = await maya.from("maintenance_requests").insert({
      lease_id: SEEDED_IDS.leaseYonatanActive,
      landlord_id: noaProfileId,
      submitted_by: mayaProfileId,
      title: "Against the wrong flat",
      description: "This must never reach the database, whatever the payload says.",
    });

    expect(error?.code).toBe("42501");
  });
});

/** Invariant 4: a landlord can only ever read or write rows they own. */
describe("invariant 4: a landlord reaches only their own rows", () => {
  it("returns nothing when a landlord names another landlord's tenancy", async () => {
    const eitan = await signInAs(SEEDED_USERS.landlordEitan);

    const { data } = await eitan.from("leases").select("id").eq("id", SEEDED_IDS.leaseMayaActive);

    expect(data).toEqual([]);
  });

  it("changes nothing when a landlord edits another landlord's tenancy", async () => {
    const eitan = await signInAs(SEEDED_USERS.landlordEitan);
    const service = serviceRoleClient();
    const before = await service
      .from("leases")
      .select("rent_amount_cents")
      .eq("id", SEEDED_IDS.leaseMayaActive)
      .single();
    const originalRent = required(before.data, "Maya's tenancy").rent_amount_cents;
    expect(originalRent).not.toBe(1);

    const { data } = await eitan
      .from("leases")
      .update({ rent_amount_cents: 1 })
      .eq("id", SEEDED_IDS.leaseMayaActive)
      .select();

    expect(data).toEqual([]);

    const after = await service
      .from("leases")
      .select("rent_amount_cents")
      .eq("id", SEEDED_IDS.leaseMayaActive)
      .single();
    expect(required(after.data, "Maya's tenancy").rent_amount_cents).toBe(originalRent);
  });
});

/**
 * Invariant 5: rent is a ledger of payments the landlord records as received.
 *
 * A tenant cannot add to it, change it or remove from it, which is what makes the ledger evidence
 * rather than an assertion either party can edit.
 */
describe("invariant 5: only a landlord writes to the ledger", () => {
  it("refuses a payment inserted by a tenant", async () => {
    const maya = await signInAs(SEEDED_USERS.tenantMaya);
    const mayaProfileId = await profileIdFor(SEEDED_USERS.tenantMaya);

    const { error } = await maya.from("rent_payments").insert({
      lease_id: SEEDED_IDS.leaseMayaActive,
      landlord_id: noaProfileId,
      recorded_by: mayaProfileId,
      period_month: "2026-08-01",
      amount_cents: 650000,
      received_on: "2026-08-01",
      method: "cash",
    });

    expect(error?.code).toBe("42501");
  });

  it("changes and deletes nothing in the ledger for a tenant", async () => {
    const maya = await signInAs(SEEDED_USERS.tenantMaya);

    const service = serviceRoleClient();
    const before = await service
      .from("rent_payments")
      .select("id, amount_cents")
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .order("received_on");
    const originalLedger = required(before.data, "Maya's ledger");
    expect(originalLedger.length).toBeGreaterThan(0);

    const updated = await maya
      .from("rent_payments")
      .update({ amount_cents: 999999 })
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .select();
    const deleted = await maya
      .from("rent_payments")
      .delete()
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .select();

    // No "?? []": an error would otherwise be indistinguishable from a refusal that returned rows,
    // and both would satisfy the assertion without the ledger being checked.
    expect(updated.data).toEqual([]);
    expect(deleted.data).toEqual([]);

    const after = await service
      .from("rent_payments")
      .select("id, amount_cents")
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .order("received_on");
    expect(required(after.data, "Maya's ledger")).toEqual(originalLedger);
  });

  // CORE-18
  it("records who entered every payment, so the ledger is attributable", async () => {
    const { data } = await serviceRoleClient()
      .from("rent_payments")
      .select("recorded_by")
      .eq("lease_id", SEEDED_IDS.leaseMayaActive);

    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((row) => row.recorded_by === noaProfileId)).toBe(true);
  });
});
