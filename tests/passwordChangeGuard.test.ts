import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { anonymousClient, serviceRoleClient } from "./support/testDatabase";
import type { Database } from "@/types/database";

/**
 * The two role guards, asked to refuse an account that still holds the temporary password its
 * landlord issued.
 *
 * This is defence in depth rather than a reachable hole. The proxy already routes a flagged account
 * to the change-password page and nowhere else, and a server action posted elsewhere was measured to
 * be refused too, because Next re-enters the proxy against the route the action belongs to. Nothing
 * in the application asserted that, and it is the framework's behaviour rather than this project's.
 * These tests make the rule the application's own, so that an upgrade which moves where middleware
 * runs fails here rather than in production.
 *
 * Each guard is asked twice: once flagged, where it must refuse, and once with the flag cleared on
 * the same account, where it must return the profile. Without the second half a guard that refused
 * everybody would pass.
 */
const { activeClient } = vi.hoisted(() => ({
  activeClient: { value: null as SupabaseClient<Database> | null },
}));

vi.mock("@/lib/supabase/serverClient", () => ({
  createSupabaseServerClient: async () => activeClient.value,
}));

const { requireLandlordProfile } = await import("@/lib/authentication/requireLandlordProfile");
const { requireTenantProfile } = await import("@/lib/authentication/requireTenantProfile");

const ACCOUNT_PASSWORD = "GuardTestPassword1";
const accountsToRemove: string[] = [];

async function createFlaggedAccount(role: "landlord" | "tenant"): Promise<string> {
  const email = `guard-${role}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
  const { data, error } = await serviceRoleClient().auth.admin.createUser({
    email,
    password: ACCOUNT_PASSWORD,
    email_confirm: true,
    user_metadata: { role, full_name: `Guard ${role}`, must_change_password: true },
  });
  if (error !== null || data.user === null) {
    throw new Error(`Could not create the ${role} account: ${error?.message}`);
  }
  accountsToRemove.push(data.user.id);

  activeClient.value = anonymousClient();
  const signIn = await activeClient.value.auth.signInWithPassword({
    email,
    password: ACCOUNT_PASSWORD,
  });
  if (signIn.error !== null) {
    throw new Error(`Could not sign in as the ${role}: ${signIn.error.message}`);
  }
  return data.user.id;
}

/** The flag is pinned against its owner by a trigger, so only the service role can clear it. */
async function clearTheFlag(accountId: string): Promise<void> {
  const { error } = await serviceRoleClient()
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", accountId);
  if (error !== null) {
    throw new Error(`Could not clear the flag: ${error.message}`);
  }
}

beforeAll(() => {
  activeClient.value = null;
});

afterAll(async () => {
  activeClient.value = null;
  for (const accountId of accountsToRemove) {
    await serviceRoleClient().auth.admin.deleteUser(accountId);
  }
});

describe("requireLandlordProfile", () => {
  it("refuses a landlord who has not replaced their temporary password", async () => {
    const accountId = await createFlaggedAccount("landlord");

    await expect(requireLandlordProfile()).rejects.toThrow(
      /must replace its temporary password/,
    );

    // The same account, same session, once the password has been dealt with.
    await clearTheFlag(accountId);
    const profile = await requireLandlordProfile();
    expect(profile.id).toBe(accountId);
    expect(profile.role).toBe("landlord");
    expect(profile.mustChangePassword).toBe(false);
  });
});

describe("requireTenantProfile", () => {
  it("refuses a tenant who has not replaced their temporary password", async () => {
    const accountId = await createFlaggedAccount("tenant");

    await expect(requireTenantProfile()).rejects.toThrow(/must replace its temporary password/);

    await clearTheFlag(accountId);
    const profile = await requireTenantProfile();
    expect(profile.id).toBe(accountId);
    expect(profile.role).toBe("tenant");
    expect(profile.mustChangePassword).toBe(false);
  });
});
