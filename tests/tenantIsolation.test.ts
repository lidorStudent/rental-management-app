import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
 * Domain invariants 3 and 5: a tenant reads and writes only rows belonging to their own tenancy,
 * and the rent ledger is the landlord's record.
 *
 * Maya and Yonatan rent two flats in the same building from the same landlord, which is the
 * arrangement most likely to leak: their rows sit next to each other, under one owner, and only the
 * tenant column tells them apart.
 */
let maya: SupabaseClient<Database>;
let yonatan: SupabaseClient<Database>;
let mayaProfileId: string;
let yonatanProfileId: string;
let noaProfileId: string;
let yonatansRequestId: string;

beforeAll(async () => {
  maya = await signInAs(SEEDED_USERS.tenantMaya);
  yonatan = await signInAs(SEEDED_USERS.tenantYonatan);
  mayaProfileId = await profileIdFor(SEEDED_USERS.tenantMaya);
  yonatanProfileId = await profileIdFor(SEEDED_USERS.tenantYonatan);
  noaProfileId = await profileIdFor(SEEDED_USERS.landlordNoa);

  const { data } = await serviceRoleClient()
    .from("maintenance_requests")
    .select("id")
    .eq("lease_id", SEEDED_IDS.leaseYonatanActive)
    .limit(1)
    .single();
  yonatansRequestId = required(data, "a request on Yonatan's tenancy").id;
});

describe("what one tenant can read of another's", () => {
  // PERM-12
  it("shows a tenant only their own tenancy", async () => {
    const { data } = await maya.from("leases").select("id");

    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(SEEDED_IDS.leaseMayaActive);
  });

  // PERM-12
  it("returns nothing when a tenant names another tenant's tenancy directly", async () => {
    const { data } = await maya.from("leases").select("id").eq("id", SEEDED_IDS.leaseYonatanActive);

    expect(data).toEqual([]);
  });

  // PERM-13
  it("shows a tenant only payments against their own tenancy", async () => {
    const { data } = await maya.from("rent_payments").select("lease_id");

    expect(data?.every((row) => row.lease_id === SEEDED_IDS.leaseMayaActive)).toBe(true);
    expect(data?.length).toBeGreaterThan(0);
  });

  // PERM-13
  it("returns nothing when a tenant asks for another tenant's payments by lease", async () => {
    const { data } = await maya
      .from("rent_payments")
      .select("id")
      .eq("lease_id", SEEDED_IDS.leaseYonatanActive);

    expect(data).toEqual([]);
  });

  // PERM-14
  it("shows a tenant only problems they reported", async () => {
    const { data } = await maya.from("maintenance_requests").select("lease_id");

    // The count first: [].every() is true, so a policy that showed the tenant nothing at all would
    // pass the assertion below without the tenant portal working.
    expect(data).toHaveLength(2);
    expect(data?.every((row) => row.lease_id === SEEDED_IDS.leaseMayaActive)).toBe(true);
  });

  // PERM-14
  it("returns nothing when a tenant names another tenant's request directly", async () => {
    const { data } = await maya
      .from("maintenance_requests")
      .select("id")
      .eq("id", yonatansRequestId);

    expect(data).toEqual([]);
  });

  // PERM-19
  it("shows a tenant only the flat they live in", async () => {
    const { data } = await maya.from("units").select("label");

    expect(data).toHaveLength(1);
    expect(data?.[0]?.label).toBe("Flat 1");
  });

  // PERM-19
  it("shows a tenant only the building they live in", async () => {
    const { data } = await maya.from("properties").select("name");

    expect(data).toHaveLength(1);
    expect(data?.[0]?.name).toBe("Rothschild 12");
  });

  /**
   * The product must not reveal that other tenants exist at all. A tenant may read themselves and
   * the landlord they need to contact, and that is the whole list.
   */
  // PERM-19
  it("shows a tenant only their own profile and their landlord's", async () => {
    const { data } = await maya.from("profiles").select("email");
    const emails = (data ?? []).map((row) => row.email).sort();

    expect(emails).toEqual([SEEDED_USERS.landlordNoa, SEEDED_USERS.tenantMaya].sort());
  });

  // PERM-19
  it("returns nothing when a tenant names another tenant's profile directly", async () => {
    const { data } = await maya.from("profiles").select("id").eq("id", yonatanProfileId);

    expect(data).toEqual([]);
  });

  // PERM-10, DB-22
  it("shows a tenant only their own row in the rent summary view", async () => {
    const { data } = await maya.from("lease_rent_summary").select("lease_id");

    expect(data).toHaveLength(1);
    expect(data?.[0]?.lease_id).toBe(SEEDED_IDS.leaseMayaActive);
  });
});

describe("what a tenant can write to the ledger and the tenancy", () => {
  // PERM-20
  it("refuses a payment inserted by a tenant", async () => {
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

  // PERM-20
  it("changes nothing when a tenant edits a payment on their own tenancy", async () => {
    const service = serviceRoleClient();
    const before = await service
      .from("rent_payments")
      .select("id, amount_cents")
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .order("received_on");
    const originalAmounts = required(before.data, "Maya's ledger").map((row) => row.amount_cents);
    expect(originalAmounts.length).toBeGreaterThan(0);

    const { data } = await maya
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

  // PERM-20
  it("deletes nothing when a tenant deletes a payment that shows them in arrears", async () => {
    const { data } = await maya
      .from("rent_payments")
      .delete()
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .select();

    expect(data).toEqual([]);

    const { count } = await serviceRoleClient()
      .from("rent_payments")
      .select("id", { count: "exact", head: true })
      .eq("lease_id", SEEDED_IDS.leaseMayaActive);
    expect(count).toBeGreaterThan(0);
  });

  // PERM-21
  it("changes nothing when a tenant extends their own tenancy", async () => {
    const service = serviceRoleClient();
    const before = await service
      .from("leases")
      .select("end_date")
      .eq("id", SEEDED_IDS.leaseMayaActive)
      .single();
    const originalEndDate = required(before.data, "Maya's tenancy").end_date;
    expect(originalEndDate).not.toBe("2030-12-31");

    const { data } = await maya
      .from("leases")
      .update({ end_date: "2030-12-31" })
      .eq("id", SEEDED_IDS.leaseMayaActive)
      .select();

    expect(data).toEqual([]);

    const after = await service
      .from("leases")
      .select("end_date")
      .eq("id", SEEDED_IDS.leaseMayaActive)
      .single();
    expect(required(after.data, "Maya's tenancy").end_date).toBe(originalEndDate);
  });

  // PERM-21
  it("changes nothing when a tenant lowers their own rent", async () => {
    const service = serviceRoleClient();
    const before = await service
      .from("leases")
      .select("rent_amount_cents")
      .eq("id", SEEDED_IDS.leaseMayaActive)
      .single();
    const originalRent = required(before.data, "Maya's tenancy").rent_amount_cents;
    expect(originalRent).not.toBe(1);

    const { data } = await maya
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

  // PERM-22
  it("refuses a tenancy created by a tenant", async () => {
    const { error } = await maya.from("leases").insert({
      unit_id: SEEDED_IDS.unitEmekRefaimGround,
      landlord_id: noaProfileId,
      tenant_profile_id: mayaProfileId,
      rent_amount_cents: 1,
      start_date: "2030-01-01",
      end_date: "2030-12-31",
      rent_due_day: 1,
    });

    expect(error?.code).toBe("42501");
  });

  // PERM-21
  it("deletes nothing when a tenant deletes their own tenancy", async () => {
    const { data } = await maya
      .from("leases")
      .delete()
      .eq("id", SEEDED_IDS.leaseMayaActive)
      .select();

    expect(data).toEqual([]);

    const { data: stillThere } = await serviceRoleClient()
      .from("leases")
      .select("id")
      .eq("id", SEEDED_IDS.leaseMayaActive);
    expect(stillThere).toHaveLength(1);
  });

  it("refuses a property or a unit created by a tenant", async () => {
    const property = await maya.from("properties").insert({
      landlord_id: mayaProfileId,
      name: "My own building",
      address_line: "Nowhere 1",
      city: "Tel Aviv-Yafo",
    });
    const unit = await maya.from("units").insert({
      property_id: SEEDED_IDS.propertyRothschild,
      landlord_id: mayaProfileId,
      label: "Mine now",
    });

    expect(property.error?.code).toBe("42501");
    expect(unit.error?.code).toBe("42501");

    // The refusal codes say the statements were rejected. These say no row arrived anyway.
    const service = serviceRoleClient();
    const { data: plantedProperty } = await service
      .from("properties")
      .select("id")
      .eq("name", "My own building");
    const { data: plantedUnit } = await service.from("units").select("id").eq("label", "Mine now");
    expect(plantedProperty).toEqual([]);
    expect(plantedUnit).toEqual([]);
  });
});

describe("what a tenant can do with maintenance", () => {
  const reportedIds: string[] = [];

  afterAll(async () => {
    if (reportedIds.length > 0) {
      await serviceRoleClient().from("maintenance_requests").delete().in("id", reportedIds);
    }
  });

  // PERM-17
  it("refuses a problem reported against another tenant's tenancy", async () => {
    const { error } = await maya.from("maintenance_requests").insert({
      lease_id: SEEDED_IDS.leaseYonatanActive,
      landlord_id: noaProfileId,
      submitted_by: mayaProfileId,
      title: "Reported against the wrong flat",
      description: "This must never reach the database, whatever the payload says.",
    });

    expect(error?.code).toBe("42501");
  });

  // PERM-18
  it("refuses a problem reported in another person's name", async () => {
    const { error } = await maya.from("maintenance_requests").insert({
      lease_id: SEEDED_IDS.leaseMayaActive,
      landlord_id: noaProfileId,
      submitted_by: yonatanProfileId,
      title: "Reported as somebody else",
      description: "Attribution cannot be forged, whatever the payload says.",
    });

    expect(error?.code).toBe("42501");
  });

  it("refuses a problem reported against a tenancy that has ended", async () => {
    const shira = await signInAs(SEEDED_USERS.tenantShira);
    const shiraProfileId = await profileIdFor(SEEDED_USERS.tenantShira);

    const { error } = await shira.from("maintenance_requests").insert({
      lease_id: SEEDED_IDS.leaseShiraEnded,
      landlord_id: noaProfileId,
      submitted_by: shiraProfileId,
      title: "Reported after moving out",
      description: "A tenancy that has ended cannot have new problems reported against it.",
    });

    expect(error?.code).toBe("42501");
  });

  it("refuses a request opened as already resolved", async () => {
    const { error } = await maya.from("maintenance_requests").insert({
      lease_id: SEEDED_IDS.leaseMayaActive,
      landlord_id: noaProfileId,
      submitted_by: mayaProfileId,
      status: "resolved",
      resolved_at: new Date().toISOString(),
      title: "Opened as resolved",
      description: "A tenant cannot decide that something was fixed before reporting it.",
    });

    expect(error?.code).toBe("42501");
  });

  it("lets a tenant report a problem on their own active tenancy", async () => {
    const { data, error } = await maya
      .from("maintenance_requests")
      .insert({
        lease_id: SEEDED_IDS.leaseMayaActive,
        landlord_id: noaProfileId,
        submitted_by: mayaProfileId,
        title: "Reported by the permission tests",
        description: "The one write a tenant has, made the way the product makes it.",
      })
      .select("id, status")
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe("submitted");
    reportedIds.push(required(data, "the request just reported").id);
  });

  /**
   * Only the landlord says the work is done. The tenant's one update policy covers their own
   * resolved requests, so the row is reachable; the trigger is what refuses the column, which is
   * why this comes back as a refusal rather than as no rows.
   */
  // PERM-23
  it("refuses a tenant moving their own request along", async () => {
    const service = serviceRoleClient();
    const { data: before } = await service
      .from("maintenance_requests")
      .select("id, status")
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .order("created_at", { ascending: true });

    const { error } = await maya
      .from("maintenance_requests")
      .update({ status: "resolved" })
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .select();

    expect(error?.code).toBe("42501");

    const { data: after } = await service
      .from("maintenance_requests")
      .select("id, status")
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .order("created_at", { ascending: true });
    expect(after).toEqual(before);
  });

  /**
   * A policy decides which rows an update may touch, never which columns, so the trigger is what
   * keeps a tenant's one write to the one column it is meant for.
   */
  // PERM-24
  it("refuses a tenant rewriting anything else while confirming a fix", async () => {
    const service = serviceRoleClient();
    const { data } = await service
      .from("maintenance_requests")
      .select("id, title")
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .eq("status", "resolved")
      .limit(1)
      .single();
    const resolved = required(data, "a resolved request on Maya's tenancy");
    await service
      .from("maintenance_requests")
      .update({ tenant_confirmed_at: null })
      .eq("id", resolved.id);

    const { error } = await maya
      .from("maintenance_requests")
      .update({ tenant_confirmed_at: new Date().toISOString(), title: "Rewritten by the tenant" })
      .eq("id", resolved.id);

    expect(error?.code).toBe("42501");

    const { data: unchanged } = await service
      .from("maintenance_requests")
      .select("title")
      .eq("id", resolved.id)
      .single();
    expect(unchanged?.title).toBe(resolved.title);
  });

  it("lets a tenant confirm a resolved request on their own tenancy, once", async () => {
    const service = serviceRoleClient();
    const { data } = await service
      .from("maintenance_requests")
      .select("id")
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .eq("status", "resolved")
      .limit(1)
      .single();
    const resolved = required(data, "a resolved request on Maya's tenancy");
    await service
      .from("maintenance_requests")
      .update({ tenant_confirmed_at: null })
      .eq("id", resolved.id);

    const { data: confirmed } = await maya
      .from("maintenance_requests")
      .update({ tenant_confirmed_at: new Date().toISOString() })
      .eq("id", resolved.id)
      .select("id");
    expect(confirmed).toHaveLength(1);

    const { data: again } = await maya
      .from("maintenance_requests")
      .update({ tenant_confirmed_at: new Date().toISOString() })
      .eq("id", resolved.id)
      .select("id");
    expect(again).toEqual([]);

    await service
      .from("maintenance_requests")
      .update({ tenant_confirmed_at: null })
      .eq("id", resolved.id);
  });

  // PERM-16
  it("changes nothing when a tenant confirms another tenant's request", async () => {
    const service = serviceRoleClient();
    const before = await service
      .from("maintenance_requests")
      .select("tenant_confirmed_at")
      .eq("id", yonatansRequestId)
      .single();
    const originalConfirmation = required(before.data, "Yonatan's request").tenant_confirmed_at;

    const { data } = await maya
      .from("maintenance_requests")
      .update({ tenant_confirmed_at: new Date().toISOString() })
      .eq("id", yonatansRequestId)
      .select();

    expect(data).toEqual([]);

    const after = await service
      .from("maintenance_requests")
      .select("tenant_confirmed_at")
      .eq("id", yonatansRequestId)
      .single();
    expect(required(after.data, "Yonatan's request").tenant_confirmed_at).toBe(
      originalConfirmation,
    );
  });

  // PERM-19
  it("shows the two tenants of one landlord nothing of each other", async () => {
    const mayaRows = required(
      (await maya.from("maintenance_requests").select("id")).data,
      "Maya's reported problems",
    );
    const yonatanRows = required(
      (await yonatan.from("maintenance_requests").select("id")).data,
      "Yonatan's reported problems",
    );
    // Both must see something of their own, or an overlap of nothing would prove nothing.
    expect(mayaRows.length).toBeGreaterThan(0);
    expect(yonatanRows.length).toBeGreaterThan(0);

    const shared = mayaRows.filter((row) => yonatanRows.some((other) => other.id === row.id));

    expect(shared).toEqual([]);
  });
});

describe("what a tenant can do to their own account", () => {
  // PERM-25
  it("refuses a tenant promoting themselves to landlord", async () => {
    const { error } = await maya
      .from("profiles")
      .update({ role: "landlord" })
      .eq("id", mayaProfileId);

    expect(error?.code).toBe("42501");

    const { data } = await serviceRoleClient()
      .from("profiles")
      .select("role")
      .eq("id", mayaProfileId)
      .single();
    expect(data?.role).toBe("tenant");
  });

  it("lets a tenant correct their own name", async () => {
    const { data } = await maya
      .from("profiles")
      .update({ full_name: "Maya Levi" })
      .eq("id", mayaProfileId)
      .select("full_name");

    expect(data).toHaveLength(1);
  });

  it("changes nothing when a tenant renames somebody else", async () => {
    const service = serviceRoleClient();
    const before = await service
      .from("profiles")
      .select("full_name")
      .eq("id", yonatanProfileId)
      .single();
    const originalName = required(before.data, "Yonatan's profile").full_name;

    const { data } = await maya
      .from("profiles")
      .update({ full_name: "Renamed by another tenant" })
      .eq("id", yonatanProfileId)
      .select();

    expect(data).toEqual([]);

    const after = await service
      .from("profiles")
      .select("full_name")
      .eq("id", yonatanProfileId)
      .single();
    expect(required(after.data, "Yonatan's profile").full_name).toBe(originalName);
  });
});
