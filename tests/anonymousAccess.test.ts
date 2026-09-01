import { beforeAll, describe, expect, it } from "vitest";

import {
  anonymousClient,
  required,
  SEEDED_IDS,
  serviceRoleClient,
  untypedAnonymousClient,
  untypedServiceRoleClient,
} from "./support/testDatabase";

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

/**
 * Every assertion below is that an anonymous caller reads nothing. An empty database satisfies all
 * of them without a single policy being correct, so this runs first and proves there was something
 * to be refused: the service role, which bypasses Row Level Security, must see rows in every
 * relation anon is about to be asked about. Unlike the rest of this suite it never calls signInAs,
 * so nothing else here would notice an unseeded project.
 */
function refuseIfEmpty(relation: string, count: number | null, error: { message: string } | null) {
  if (error !== null) {
    throw new Error(`Could not count ${relation} as the service role: ${error.message}`);
  }
  if ((count ?? 0) === 0) {
    throw new Error(
      `${relation} is empty, so "reads nothing" would prove nothing. Run "npm run db:seed" against the test project first.`,
    );
  }
}

beforeAll(async () => {
  const service = serviceRoleClient();

  // Tables and views are separate overloads on the typed client, so they are counted separately.
  for (const table of EVERY_TABLE) {
    const { count, error } = await service.from(table).select("*", { count: "exact", head: true });
    refuseIfEmpty(table, count, error);
  }
  for (const view of EVERY_VIEW) {
    const { count, error } = await service.from(view).select("*", { count: "exact", head: true });
    refuseIfEmpty(view, count, error);
  }
});

describe("a client with no session", () => {
  // PERM-30
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

  // PERM-30
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

  // PERM-30
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

  // PERM-30
  it("changes and deletes nothing", async () => {
    const client = anonymousClient();
    const service = serviceRoleClient();

    const leaseBefore = await service
      .from("leases")
      .select("rent_amount_cents")
      .eq("id", SEEDED_IDS.leaseMayaActive)
      .single();
    const originalRent = required(leaseBefore.data, "Maya's tenancy").rent_amount_cents;
    const { count: paymentsBefore } = await service
      .from("rent_payments")
      .select("id", { count: "exact", head: true })
      .eq("lease_id", SEEDED_IDS.leaseMayaActive);

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

    // No "?? []": that turned an error into an empty array, so the assertion held whether the write
    // was refused or never reached the database at all.
    expect(updated.data).toBeNull();
    expect(deleted.data).toBeNull();

    const leaseAfter = await service
      .from("leases")
      .select("rent_amount_cents")
      .eq("id", SEEDED_IDS.leaseMayaActive)
      .single();
    const { count: paymentsAfter } = await service
      .from("rent_payments")
      .select("id", { count: "exact", head: true })
      .eq("lease_id", SEEDED_IDS.leaseMayaActive);

    expect(required(leaseAfter.data, "Maya's tenancy").rent_amount_cents).toBe(originalRent);
    expect(paymentsAfter).toBe(paymentsBefore);
  });

  /**
   * The tests above prove Row Level Security refuses an anonymous write. These prove the anonymous
   * role is not permitted to attempt one, which is a different claim and a second line: the grant is
   * checked before any policy is consulted.
   *
   * The two refusals share the code 42501 and are told apart by their message. A policy refusal
   * reads "new row violates row-level security policy for table ..."; a missing grant reads
   * "permission denied for table ...". Asserting the message is what makes these fail if the grants
   * are ever handed back, rather than passing on the policy underneath.
   *
   * Update and delete carry the per-table claim because they are the pair that discriminates: before
   * the grants were revoked, both returned no error at all, since the policy simply matched no rows.
   * Insert was already refused by the policy then, so it is asserted once, below, where a concrete
   * row can be written without the table name being a union that types every column as never.
   */
  const NOWHERE = "00000000-0000-4000-8000-000000000000";

  // PERM-36
  it.each(EVERY_TABLE)(
    "is refused an update and a delete on %s by the grant, before any policy",
    async (table) => {
      const client = anonymousClient();

      // The update needs a real column in its payload: PostgREST turns an empty patch into no
      // statement at all, so it would never reach the privilege check. created_at is on all six.
      const updated = await client
        .from(table)
        .update({ created_at: "2026-01-01T00:00:00Z" })
        .eq("id", NOWHERE)
        .select();
      const deleted = await client.from(table).delete().eq("id", NOWHERE).select();

      for (const attempt of [updated, deleted]) {
        expect(attempt.error?.code).toBe("42501");
        expect(attempt.error?.message).toContain("permission denied");
      }
    },
  );

  // PERM-36
  it("is refused an insert by the grant rather than by the policy", async () => {
    const { error } = await anonymousClient()
      .from("properties")
      .insert({
        landlord_id: NOWHERE,
        name: "Written by nobody",
        address_line: "Nowhere 1",
        city: "Tel Aviv-Yafo",
      })
      .select();

    expect(error?.code).toBe("42501");
    // Before the revoke this same attempt failed with "new row violates row-level security policy".
    expect(error?.message).toContain("permission denied");
  });

  /**
   * The sibling of PERM-36, and it has to be written differently.
   *
   * PERM-36 asserts its three by attempting them: the client sends an insert, an update and a
   * delete, and reads the refusal. There is no attempt to make for truncate, because PostgREST
   * exposes no verb that reaches it, and the catalogue that would answer the question directly is
   * not in the exposed schemas - information_schema and pg_catalog both answer PGRST205 for the
   * service role as well as for anon. So the guarantee is read from anon_write_privileges, a view
   * that exists for this and reports four booleans per relation.
   *
   * truncate matters more than the shape of this test suggests. A policy restricts which rows a
   * statement sees, and truncate does not look at rows, so unlike delete it is not filtered by Row
   * Level Security at all. Of everything anon once held it was the only write with no backstop
   * underneath it.
   */
  // PERM-38
  it("holds no write privilege on any relation, truncate included", async () => {
    const { data, error } = await untypedServiceRoleClient()
      .from("anon_write_privileges")
      .select("table_name, may_insert, may_update, may_delete, may_truncate")
      .order("table_name");

    expect(error).toBeNull();
    const relations = required(data, "the anon privilege view");
    // Six tables and three views. If this number falls, a relation has stopped being reported and
    // the assertions below would pass by not looking.
    expect(relations).toHaveLength(9);

    for (const relation of relations) {
      expect(relation.may_insert, `insert on ${relation.table_name}`).toBe(false);
      expect(relation.may_update, `update on ${relation.table_name}`).toBe(false);
      expect(relation.may_delete, `delete on ${relation.table_name}`).toBe(false);
      expect(relation.may_truncate, `truncate on ${relation.table_name}`).toBe(false);
    }
  });

  /**
   * The view is a verification tool, not part of the product, so nobody the product can be is
   * allowed to read it.
   */
  // PERM-39
  it("cannot read the view that reports its own privileges", async () => {
    const { error } = await untypedAnonymousClient().from("anon_write_privileges").select("*");

    expect(error?.code).toBe("42501");
    expect(error?.message).toContain("permission denied");
  });

  // PERM-37
  it("may still read, which is what the health check depends on", async () => {
    const { count, error } = await anonymousClient()
      .from("properties")
      .select("id", { count: "exact", head: true });

    expect(error).toBeNull();
    expect(count).toBe(0);
  });
});
