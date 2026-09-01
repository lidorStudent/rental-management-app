import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import {
  SEEDED_IDS,
  SEEDED_USERS,
  profileIdFor,
  required,
  serviceRoleClient,
  signInAs,
} from "./support/testDatabase";
import type { Database } from "@/types/database";

/**
 * Domain invariant 4: a landlord can only ever read or write rows they own.
 *
 * Every attempt here is made directly against Postgres with that landlord's own credentials, the
 * same ones their browser holds. Nothing goes through a page or an action, because a page proves
 * only that a page behaves; this proves that the database refuses regardless of what asks it.
 *
 * Noa owns two buildings, five units and four tenancies. Eitan owns one building, two units and one
 * tenancy. Neither may see or touch anything of the other's.
 */
let noa: SupabaseClient<Database>;
let eitan: SupabaseClient<Database>;
let eitanProfileId: string;

beforeAll(async () => {
  noa = await signInAs(SEEDED_USERS.landlordNoa);
  eitan = await signInAs(SEEDED_USERS.landlordEitan);
  eitanProfileId = await profileIdFor(SEEDED_USERS.landlordEitan);
});

describe("what one landlord can read of another's", () => {
  // PERM-01
  it("shows a landlord only their own properties", async () => {
    const { data } = await eitan.from("properties").select("id, name");

    expect(data?.map((row) => row.name)).toEqual(["HaNamal 5"]);
  });

  // PERM-01
  it("returns nothing when a landlord names another landlord's property directly", async () => {
    const { data } = await eitan
      .from("properties")
      .select("id")
      .eq("id", SEEDED_IDS.propertyRothschild);

    expect(data).toEqual([]);
  });

  // PERM-02
  it("shows a landlord only their own units", async () => {
    const { data } = await eitan.from("units").select("label");

    expect(data?.map((row) => row.label).sort()).toEqual(["Flat A", "Flat B"]);
  });

  // PERM-02
  it("returns nothing when a landlord names another landlord's unit directly", async () => {
    const { data } = await eitan.from("units").select("id").eq("id", SEEDED_IDS.unitRothschildOne);

    expect(data).toEqual([]);
  });

  // PERM-03
  it("shows a landlord only their own tenancies", async () => {
    const { data } = await eitan.from("leases").select("id");

    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(SEEDED_IDS.leaseDanaActive);
  });

  // PERM-03
  it("returns nothing when a landlord names another landlord's tenancy directly", async () => {
    const { data } = await eitan.from("leases").select("id").eq("id", SEEDED_IDS.leaseMayaActive);

    expect(data).toEqual([]);
  });

  // PERM-04
  it("shows a landlord only their own ledger", async () => {
    const { data } = await eitan.from("rent_payments").select("lease_id");

    expect(data?.every((row) => row.lease_id === SEEDED_IDS.leaseDanaActive)).toBe(true);
    expect(data?.length).toBeGreaterThan(0);
  });

  // PERM-04
  it("returns nothing when a landlord asks for another landlord's payments by lease", async () => {
    const { data } = await eitan
      .from("rent_payments")
      .select("id")
      .eq("lease_id", SEEDED_IDS.leaseMayaActive);

    expect(data).toEqual([]);
  });

  // PERM-05
  it("shows a landlord only problems reported against their own units", async () => {
    const { data } = await eitan.from("maintenance_requests").select("lease_id");

    // The count first: [].every() is true, so without it a policy that returned nothing to
    // everybody would pass this test while breaking the page.
    expect(data).toHaveLength(1);
    expect(data?.every((row) => row.lease_id === SEEDED_IDS.leaseDanaActive)).toBe(true);
  });

  it("shows a landlord only their own profile and their own tenants", async () => {
    const { data } = await eitan.from("profiles").select("email");
    const emails = (data ?? []).map((row) => row.email).sort();

    expect(emails).toEqual([SEEDED_USERS.landlordEitan, SEEDED_USERS.tenantDana].sort());
  });

  /**
   * The aggregate views are the place a mistake would be quietest: a view without security_invoker
   * would hand every landlord's totals to whoever asked.
   */
  // PERM-10, DB-22
  it("shows a landlord only their own rows in the rent summary view", async () => {
    const { data } = await eitan.from("lease_rent_summary").select("lease_id");

    expect(data).toHaveLength(1);
    expect(data?.[0]?.lease_id).toBe(SEEDED_IDS.leaseDanaActive);
  });

  // PERM-10, DB-22
  it("shows a landlord only their own months in the collection view", async () => {
    const { data } = await eitan.from("rent_collected_by_month").select("landlord_id");

    // A view that returned nothing to anybody would satisfy every() and prove nothing about
    // security_invoker, which is the only thing standing between this view and every landlord's
    // totals. The count is what makes the assertion below mean something.
    expect(data).toHaveLength(3);
    expect(data?.every((row) => row.landlord_id === eitanProfileId)).toBe(true);
  });

  // PERM-10, DB-22
  it("shows a landlord only their own months in the period totals view", async () => {
    const { data } = await eitan.from("lease_period_totals").select("lease_id");

    expect(data).toHaveLength(3);
    expect(data?.every((row) => row.lease_id === SEEDED_IDS.leaseDanaActive)).toBe(true);
  });
});

describe("what one landlord can write to another's", () => {
  it("changes nothing when a landlord updates another landlord's property", async () => {
    const service = serviceRoleClient();
    const before = await service
      .from("properties")
      .select("name")
      .eq("id", SEEDED_IDS.propertyRothschild)
      .single();
    const originalName = required(before.data, "Noa's building").name;

    const { data } = await eitan
      .from("properties")
      .update({ name: "Taken over" })
      .eq("id", SEEDED_IDS.propertyRothschild)
      .select();

    expect(data).toEqual([]);

    // An empty result says the policy matched no rows. Reading the row back says the row is
    // still what it was, which is the claim the title actually makes.
    const after = await service
      .from("properties")
      .select("name")
      .eq("id", SEEDED_IDS.propertyRothschild)
      .single();
    expect(required(after.data, "Noa's building").name).toBe(originalName);
  });

  // PERM-06
  it("changes nothing when a landlord updates another landlord's tenancy", async () => {
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

  it("changes nothing when a landlord corrects another landlord's payment", async () => {
    const service = serviceRoleClient();
    const before = await service
      .from("rent_payments")
      .select("id, amount_cents")
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .order("received_on");
    const originalAmounts = required(before.data, "Maya's ledger").map((row) => row.amount_cents);
    expect(originalAmounts.length).toBeGreaterThan(0);

    const { data } = await eitan
      .from("rent_payments")
      .update({ amount_cents: 1 })
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .select();

    expect(data).toEqual([]);

    const after = await service
      .from("rent_payments")
      .select("id, amount_cents")
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .order("received_on");
    expect(required(after.data, "Maya's ledger").map((row) => row.amount_cents)).toEqual(
      originalAmounts,
    );
  });

  it("changes nothing when a landlord moves another landlord's request along", async () => {
    const service = serviceRoleClient();
    const before = await service
      .from("maintenance_requests")
      .select("id, status")
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .order("created_at");
    const originalStatuses = required(before.data, "Maya's reported problems").map(
      (row) => row.status,
    );
    expect(originalStatuses.length).toBeGreaterThan(0);

    const { data } = await eitan
      .from("maintenance_requests")
      .update({ status: "resolved" })
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .select();

    expect(data).toEqual([]);

    const after = await service
      .from("maintenance_requests")
      .select("id, status")
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .order("created_at");
    expect(required(after.data, "Maya's reported problems").map((row) => row.status)).toEqual(
      originalStatuses,
    );
  });

  // PERM-07
  it("deletes nothing when a landlord deletes another landlord's unit", async () => {
    const { data } = await eitan
      .from("units")
      .delete()
      .eq("id", SEEDED_IDS.unitEmekRefaimFirst)
      .select();

    expect(data).toEqual([]);

    const { data: stillThere } = await serviceRoleClient()
      .from("units")
      .select("id")
      .eq("id", SEEDED_IDS.unitEmekRefaimFirst);
    expect(stillThere).toHaveLength(1);
  });

  it("deletes nothing when a landlord deletes another landlord's property", async () => {
    const { data } = await eitan
      .from("properties")
      .delete()
      .eq("id", SEEDED_IDS.propertyEmekRefaim)
      .select();

    expect(data).toEqual([]);

    const { data: stillThere } = await serviceRoleClient()
      .from("properties")
      .select("id")
      .eq("id", SEEDED_IDS.propertyEmekRefaim);
    expect(stillThere).toHaveLength(1);
  });

  // PERM-08
  it("refuses a unit planted inside another landlord's building", async () => {
    const { error } = await eitan.from("units").insert({
      property_id: SEEDED_IDS.propertyRothschild,
      landlord_id: eitanProfileId,
      label: "Smuggled in",
    });

    expect(error?.code).toBe("42501");
  });

  it("refuses a property inserted in another landlord's name", async () => {
    const noaProfileId = await profileIdFor(SEEDED_USERS.landlordNoa);

    const { error } = await eitan.from("properties").insert({
      landlord_id: noaProfileId,
      name: "Not mine",
      address_line: "Somewhere else 1",
      city: "Haifa",
    });

    expect(error?.code).toBe("42501");
  });

  it("refuses a tenancy on another landlord's unit", async () => {
    const { error } = await eitan.from("leases").insert({
      unit_id: SEEDED_IDS.unitRothschildOne,
      landlord_id: eitanProfileId,
      rent_amount_cents: 100000,
      start_date: "2030-01-01",
      end_date: "2030-12-31",
      rent_due_day: 1,
    });

    expect(error?.code).toBe("42501");
  });

  // PERM-09
  it("refuses a payment recorded against another landlord's tenancy", async () => {
    const { error } = await eitan.from("rent_payments").insert({
      lease_id: SEEDED_IDS.leaseMayaActive,
      landlord_id: eitanProfileId,
      recorded_by: eitanProfileId,
      period_month: "2026-08-01",
      amount_cents: 100,
      received_on: "2026-08-01",
      method: "cash",
    });

    expect(error?.code).toBe("42501");
  });
});

/**
 * The other half of the claim. Policies that refused everything would pass every test above and
 * make the product useless, so a landlord is put through the whole set of operations on their own
 * rows and the rows are removed again afterwards.
 */
describe("what a landlord can do with their own data", () => {
  // CORE-03, CORE-04
  it("creates, reads, updates and deletes a property of their own", async () => {
    const noaProfileId = await profileIdFor(SEEDED_USERS.landlordNoa);

    const { data: created, error: insertError } = await noa
      .from("properties")
      .insert({
        landlord_id: noaProfileId,
        name: "Test building",
        address_line: "Test Street 1",
        city: "Tel Aviv-Yafo",
      })
      .select("id")
      .single();

    expect(insertError).toBeNull();
    const createdPropertyId = required(created, "the property just created").id;

    const { data: read } = await noa
      .from("properties")
      .select("name")
      .eq("id", createdPropertyId)
      .single();
    expect(read?.name).toBe("Test building");

    const { data: updated } = await noa
      .from("properties")
      .update({ name: "Test building, renamed" })
      .eq("id", createdPropertyId)
      .select("name")
      .single();
    expect(updated?.name).toBe("Test building, renamed");

    const { data: deleted } = await noa
      .from("properties")
      .delete()
      .eq("id", createdPropertyId)
      .select();
    expect(deleted).toHaveLength(1);
  });

  // CORE-19
  it("records and corrects a payment on their own tenancy, then removes it", async () => {
    const noaProfileId = await profileIdFor(SEEDED_USERS.landlordNoa);

    const { data: createdPayment, error } = await noa
      .from("rent_payments")
      .insert({
        lease_id: SEEDED_IDS.leaseMayaActive,
        landlord_id: noaProfileId,
        recorded_by: noaProfileId,
        period_month: "2026-08-01",
        amount_cents: 100,
        received_on: "2026-08-01",
        method: "cash",
        reference: "Written by the permission tests",
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    const createdPaymentId = required(createdPayment, "the payment just recorded").id;

    const { data: corrected } = await noa
      .from("rent_payments")
      .update({ amount_cents: 200 })
      .eq("id", createdPaymentId)
      .select("amount_cents")
      .single();
    expect(corrected?.amount_cents).toBe(200);

    const { data: removed } = await noa
      .from("rent_payments")
      .delete()
      .eq("id", createdPaymentId)
      .select();
    expect(removed).toHaveLength(1);
  });

  it("moves a problem on their own unit along", async () => {
    const service = serviceRoleClient();
    const { data } = await service
      .from("maintenance_requests")
      .select("id, status")
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .eq("status", "in_progress")
      .single();
    const request = required(data, "a request being worked on for Maya");

    const { data: updated } = await noa
      .from("maintenance_requests")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", request.id)
      .select("status")
      .single();

    expect(updated?.status).toBe("resolved");

    await service
      .from("maintenance_requests")
      .update({ status: request.status, resolved_at: null })
      .eq("id", request.id);
  });
});
