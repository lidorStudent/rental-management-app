import { describe, expect, it } from "vitest";

import { anonymousClient, SEEDED_IDS } from "./support/testDatabase";

/**
 * What the key that ships to every browser is worth on its own.
 *
 * The anonymous key is in the JavaScript of every page, so anybody can read it and use it. This is
 * the test that says that is safe: with no session there is no auth.uid(), no policy matches, and
 * every table answers with nothing.
 */
const EVERY_TABLE = [
  "profiles",
  "properties",
  "units",
  "leases",
  "rent_payments",
  "maintenance_requests",
] as const;

const EVERY_VIEW = [
  "lease_rent_summary",
  "lease_period_totals",
  "rent_collected_by_month",
] as const;

describe("a client with no session", () => {
  it.each(EVERY_TABLE)("reads nothing from %s", async (table) => {
    const { data, error } = await anonymousClient().from(table).select("*");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it.each(EVERY_VIEW)("reads nothing from %s", async (view) => {
    const { data, error } = await anonymousClient().from(view).select("*");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("reads nothing even when naming a row it knows exists", async () => {
    const client = anonymousClient();

    const lease = await client.from("leases").select("id").eq("id", SEEDED_IDS.leaseMayaActive);
    const property = await client
      .from("properties")
      .select("id")
      .eq("id", SEEDED_IDS.propertyRothschild);

    expect(lease.data).toEqual([]);
    expect(property.data).toEqual([]);
  });

  it("writes nothing anywhere", async () => {
    const client = anonymousClient();

    const property = await client.from("properties").insert({
      landlord_id: SEEDED_IDS.propertyRothschild,
      name: "Written by nobody",
      address_line: "Nowhere 1",
      city: "Tel Aviv-Yafo",
    });
    const payment = await client.from("rent_payments").insert({
      lease_id: SEEDED_IDS.leaseMayaActive,
      landlord_id: SEEDED_IDS.propertyRothschild,
      recorded_by: SEEDED_IDS.propertyRothschild,
      period_month: "2026-08-01",
      amount_cents: 1,
      received_on: "2026-08-01",
      method: "cash",
    });

    expect(property.error?.code).toBe("42501");
    expect(payment.error?.code).toBe("42501");
  });

  it("changes and deletes nothing", async () => {
    const client = anonymousClient();

    const updated = await client
      .from("leases")
      .update({ rent_amount_cents: 1 })
      .eq("id", SEEDED_IDS.leaseMayaActive)
      .select();
    const deleted = await client
      .from("rent_payments")
      .delete()
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .select();

    expect(updated.data ?? []).toEqual([]);
    expect(deleted.data ?? []).toEqual([]);
  });
});
