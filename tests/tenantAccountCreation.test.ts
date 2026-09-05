import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { required, serviceRoleClient, signInAs } from "./support/testDatabase";
import type { Database } from "@/types/database";

/**
 * The two halves of creating a tenant account that the audit found wanting.
 *
 * The check that a lease has no tenant is a read, and the attach that follows it used to be an
 * unconditional write. Two submissions for one lease both passed the check, both created an Auth
 * account, and the second overwrote the first — leaving an account attached to nothing that could
 * still sign in to an empty portal. And when the attach failed, the rollback's own error was
 * discarded and the landlord was told "Nothing was created", which is false if that rollback failed
 * and is the half that sends them away from a problem rather than towards it.
 *
 * The race is driven against the real database, because a compare and set is a claim about Postgres.
 * The message is driven with a forced failure, because a delete that fails is not something the test
 * project can be asked for on demand.
 */
const { activeClient } = vi.hoisted(() => ({
  activeClient: { value: null as SupabaseClient<Database> | null },
}));

/** Real by default. When set, the admin client's deleteUser answers with this instead. */
const { forcedDeleteError } = vi.hoisted(() => ({
  forcedDeleteError: { value: null as { code: string; message: string } | null },
}));

/** When set, the attach reports this failure instead of running. */
const { forcedAttachError } = vi.hoisted(() => ({
  forcedAttachError: { value: null as { code: string; message: string } | null },
}));

vi.mock("@/lib/supabase/serverClient", () => ({
  createSupabaseServerClient: async () => {
    const client = activeClient.value;
    if (client === null || forcedAttachError.value === null) {
      return client;
    }
    // Everything reads as normal; only the update to leases is made to fail.
    return new Proxy(client, {
      get(target, property) {
        if (property !== "from") {
          return Reflect.get(target, property);
        }
        return (table: string) => {
          const builder = target.from(table as "leases");
          if (table !== "leases") {
            return builder;
          }
          return new Proxy(builder, {
            get(builderTarget, builderProperty) {
              if (builderProperty !== "update") {
                return Reflect.get(builderTarget, builderProperty);
              }
              // Shaped to satisfy both the compare-and-set chain (.eq().is().select()) and the
              // plain .eq() the code used before it, so the same test can be run against either.
              const failure = { data: null, error: forcedAttachError.value };
              const thenableFailure = {
                is: () => ({ select: async () => failure }),
                select: async () => failure,
                then: (resolve: (value: typeof failure) => unknown) => resolve(failure),
              };
              return () => ({ eq: () => thenableFailure });
            },
          });
        };
      },
    });
  },
}));

vi.mock("@/lib/supabase/adminClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/adminClient")>();
  return {
    createSupabaseAdminClient: () => {
      const client = actual.createSupabaseAdminClient();
      if (forcedDeleteError.value === null) {
        return client;
      }
      return new Proxy(client, {
        get(target, property) {
          if (property !== "auth") {
            return Reflect.get(target, property);
          }
          return {
            ...target.auth,
            admin: {
              ...target.auth.admin,
              createUser: target.auth.admin.createUser.bind(target.auth.admin),
              deleteUser: async () => ({ data: null, error: forcedDeleteError.value }),
            },
          };
        },
      });
    },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { createTenantAccountForLease } = await import("@/actions/tenantAccountActions");

const LANDLORD_PASSWORD = "TenantAccountTest1";
const accountsToRemove: string[] = [];
const landlordIdsToClean: string[] = [];

async function createLandlordWithAVacantLease(): Promise<{ leaseId: string }> {
  const service = serviceRoleClient();
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const landlord = await service.auth.admin.createUser({
    email: `tenant-account-landlord-${stamp}@example.com`,
    password: LANDLORD_PASSWORD,
    email_confirm: true,
    user_metadata: { role: "landlord", full_name: "Tenant Account Landlord" },
  });
  const landlordId = required(landlord.data.user, "the landlord just created").id;
  accountsToRemove.push(landlordId);
  landlordIdsToClean.push(landlordId);

  const property = await service
    .from("properties")
    .insert({
      landlord_id: landlordId,
      name: `Tenant Account Building ${stamp}`,
      address_line: "Compare And Set Street 1",
      city: "Tel Aviv-Yafo",
    })
    .select("id")
    .single();
  const unit = await service
    .from("units")
    .insert({
      property_id: required(property.data, "the property").id,
      landlord_id: landlordId,
      label: "Flat 1",
    })
    .select("id")
    .single();

  const today = new Date();
  const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
    .toISOString()
    .slice(0, 10);
  const endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 11, 0))
    .toISOString()
    .slice(0, 10);

  const lease = await service
    .from("leases")
    .insert({
      unit_id: required(unit.data, "the unit").id,
      landlord_id: landlordId,
      tenant_profile_id: null,
      rent_amount_cents: 650000,
      deposit_amount_cents: 0,
      start_date: startDate,
      end_date: endDate,
      rent_due_day: 10,
    })
    .select("id")
    .single();

  activeClient.value = await signInAs(
    required(landlord.data.user, "the landlord").email ?? "",
    LANDLORD_PASSWORD,
  );

  return { leaseId: required(lease.data, "the lease").id };
}

/** Whatever account ended up under an address, if any, so the test can assert and clean up. */
async function accountIdFor(email: string): Promise<string | null> {
  const { data } = await serviceRoleClient().from("profiles").select("id").eq("email", email);
  return (data ?? [])[0]?.id ?? null;
}

beforeAll(() => {
  forcedDeleteError.value = null;
  forcedAttachError.value = null;
});

afterAll(async () => {
  forcedDeleteError.value = null;
  forcedAttachError.value = null;
  activeClient.value = null;

  const service = serviceRoleClient();
  for (const landlordId of landlordIdsToClean) {
    for (const table of ["maintenance_requests", "rent_payments", "leases", "units", "properties"] as const) {
      await service.from(table).delete().eq("landlord_id", landlordId);
    }
  }
  for (const accountId of accountsToRemove) {
    await service.auth.admin.deleteUser(accountId);
  }
});

describe("two submissions for one lease", () => {
  /**
   * Both calls read a lease with no tenant, so both reach the attach. Exactly one may win. Without
   * the compare and set both reported success, the lease pointed at the second, and the first
   * account was left behind able to sign in.
   */
  it("attaches one tenant and refuses the other, leaving no account behind", async () => {
    const { leaseId } = await createLandlordWithAVacantLease();
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const firstEmail = `race-one-${stamp}@example.com`;
    const secondEmail = `race-two-${stamp}@example.com`;

    const [first, second] = await Promise.all([
      createTenantAccountForLease({
        leaseId,
        tenantFullName: "Race One",
        tenantEmail: firstEmail,
      }),
      createTenantAccountForLease({
        leaseId,
        tenantFullName: "Race Two",
        tenantEmail: secondEmail,
      }),
    ]);

    // Recorded before the assertions: an assertion that fails must not leave accounts behind, which
    // is exactly what happened while this test was being driven against the old code.
    const firstId = await accountIdFor(firstEmail);
    const secondId = await accountIdFor(secondEmail);
    const survivors = [firstId, secondId].filter((id) => id !== null);
    accountsToRemove.push(...survivors);

    const outcomes = [first.status, second.status].sort();
    expect(outcomes).toEqual(["error", "success"]);

    const refusal = first.status === "error" ? first : second.status === "error" ? second : null;
    expect(refusal?.status === "error" ? refusal.message : "").toContain(
      "This lease already has a tenant account.",
    );

    // The lease points at the winner, and the loser's account is gone rather than orphaned.
    const { data: leaseRow } = await serviceRoleClient()
      .from("leases")
      .select("tenant_profile_id")
      .eq("id", leaseId)
      .single();
    const attachedTenantId = required(leaseRow, "the lease after the race").tenant_profile_id;
    expect(attachedTenantId).not.toBeNull();

    expect(survivors).toHaveLength(1);
    expect(survivors[0]).toBe(attachedTenantId);
  });
});

describe("when the account cannot be linked and cannot be removed again", () => {
  /**
   * The message the landlord is given has to be true. "Nothing was created" is what sends them away
   * from an account that exists and can sign in.
   */
  it("does not claim nothing was created, and says an account may exist", async () => {
    const { leaseId } = await createLandlordWithAVacantLease();
    const email = `rollback-failed-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;

    forcedAttachError.value = { code: "57014", message: "statement timeout" };
    forcedDeleteError.value = { code: "500", message: "the account could not be deleted" };

    try {
      const result = await createTenantAccountForLease({
        leaseId,
        tenantFullName: "Rollback Failed",
        tenantEmail: email,
      });

      // This test deliberately strands an account, so record it before anything can fail.
      const strandedId = await accountIdFor(email);
      if (strandedId !== null) {
        accountsToRemove.push(strandedId);
      }

      expect(result.status).toBe("error");
      const message = result.status === "error" ? result.message : "";
      expect(message).not.toContain("Nothing was created");
      expect(message).toContain("An account may now exist for that email address");

      // The account really is still there, which is what the message now admits.
      expect(strandedId).not.toBeNull();
    } finally {
      forcedAttachError.value = null;
      forcedDeleteError.value = null;
    }
  });

  /**
   * The control. With the rollback working, the original sentence is still the right one, so the
   * test above is not passing merely because the wording changed for every failure.
   */
  it("still says nothing was created when the account really was removed", async () => {
    const { leaseId } = await createLandlordWithAVacantLease();
    const email = `rollback-worked-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;

    forcedAttachError.value = { code: "57014", message: "statement timeout" };

    try {
      const result = await createTenantAccountForLease({
        leaseId,
        tenantFullName: "Rollback Worked",
        tenantEmail: email,
      });

      expect(result.status).toBe("error");
      expect(result.status === "error" ? result.message : "").toContain("Nothing was created");
    } finally {
      forcedAttachError.value = null;
    }

    expect(await accountIdFor(email)).toBeNull();
  });
});
