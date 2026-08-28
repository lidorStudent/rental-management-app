import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { anonymousClient, serviceRoleClient, signInAs, required } from "./support/testDatabase";
import type { Database } from "@/types/database";

/**
 * Changing a password, run for real against the test database.
 *
 * This has its own file rather than joining serverActions.test.ts because it needs two mocks that
 * file does not want: next/navigation, so that the redirect at the end of a successful change can be
 * observed instead of thrown past, and a switchable password-check client, so the throttled branch
 * can be exercised without making thirty failed sign-ins inside a test run.
 *
 * The check itself is real everywhere except that one test. PERM-40 is the finding: a session was
 * once enough on its own to take an account over.
 */
const { activeClient } = vi.hoisted(() => ({
  activeClient: { value: null as SupabaseClient<Database> | null },
}));
const { forcedVerificationError } = vi.hoisted(() => ({
  forcedVerificationError: {
    value: null as { status: number; code: string; message: string } | null,
  },
}));
const { lastRedirect } = vi.hoisted(() => ({ lastRedirect: { value: null as string | null } }));

vi.mock("@/lib/supabase/serverClient", () => ({
  createSupabaseServerClient: async () => activeClient.value,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    lastRedirect.value = path;
    throw new Error("NEXT_REDIRECT");
  },
}));

/**
 * Real by default. When forcedVerificationError is set, the check answers with that instead, which is
 * the only way to see the throttled branch without actually being throttled.
 */
vi.mock("@/lib/supabase/passwordCheckClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/passwordCheckClient")>();
  return {
    createSupabasePasswordCheckClient: () => {
      if (forcedVerificationError.value === null) {
        return actual.createSupabasePasswordCheckClient();
      }
      const error = forcedVerificationError.value;
      return {
        auth: { signInWithPassword: async () => ({ data: { session: null, user: null }, error }) },
      } as unknown as ReturnType<typeof actual.createSupabasePasswordCheckClient>;
    },
  };
});

const { changePassword } = await import("@/actions/authenticationActions");

const ORIGINAL_PASSWORD = "TheirOriginal1";
const accountsToRemove: string[] = [];

async function createAccount(mustChangePassword: boolean): Promise<{ id: string; email: string }> {
  const email = `password-change-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
  const { data, error } = await serviceRoleClient().auth.admin.createUser({
    email,
    password: ORIGINAL_PASSWORD,
    email_confirm: true,
    user_metadata: {
      role: "tenant",
      full_name: "Password Change",
      must_change_password: mustChangePassword,
    },
  });
  if (error !== null || data.user === null) {
    throw new Error(`Could not create the account: ${error?.message}`);
  }
  accountsToRemove.push(data.user.id);
  return { id: data.user.id, email };
}

async function canSignInWith(email: string, password: string): Promise<boolean> {
  const { error } = await anonymousClient().auth.signInWithPassword({ email, password });
  return error === null;
}

beforeAll(() => {
  forcedVerificationError.value = null;
  lastRedirect.value = null;
});

afterAll(async () => {
  forcedVerificationError.value = null;
  for (const id of accountsToRemove) {
    await serviceRoleClient().auth.admin.deleteUser(id);
  }
});

/**
 * The finding, stated as a test. Before the current-password check existed, holding a session was
 * the whole of the requirement: this same call succeeded and the owner was locked out.
 */
describe("somebody holding a session who does not know the password", () => {
  // PERM-40
  it("cannot change it, and is told which field is wrong", async () => {
    const account = await createAccount(false);
    activeClient.value = await signInAs(account.email, ORIGINAL_PASSWORD);

    const result = await changePassword({
      currentPassword: "NotTheirPassword9",
      newPassword: "TakenOver1",
      confirmPassword: "TakenOver1",
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toContain("not your current password");
      expect(result.fieldErrors?.currentPassword).toBeDefined();
      // The message names the field and nothing else: not whether the account exists, and not
      // whatever Supabase said underneath.
      expect(result.message).not.toMatch(/invalid login credentials|supabase|400/i);
    }

    expect(await canSignInWith(account.email, ORIGINAL_PASSWORD)).toBe(true);
    expect(await canSignInWith(account.email, "TakenOver1")).toBe(false);
  });
});

describe("changing a password with the current one", () => {
  // PERM-41
  it("lets a tenant replace the temporary password they were given, and clears the flag", async () => {
    const account = await createAccount(true);
    activeClient.value = await signInAs(account.email, ORIGINAL_PASSWORD);
    lastRedirect.value = null;

    await expect(
      changePassword({
        currentPassword: ORIGINAL_PASSWORD,
        newPassword: "ChosenByThem1",
        confirmPassword: "ChosenByThem1",
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    // The redirect is what proves the whole action ran: it is the last line, after the flag is
    // cleared, so reaching it means nothing in between returned early.
    expect(lastRedirect.value).toBe("/tenant");

    const { data: profile } = await serviceRoleClient()
      .from("profiles")
      .select("must_change_password")
      .eq("id", account.id)
      .maybeSingle();
    expect(required(profile, "the profile after the change").must_change_password).toBe(false);

    expect(await canSignInWith(account.email, "ChosenByThem1")).toBe(true);
    expect(await canSignInWith(account.email, ORIGINAL_PASSWORD)).toBe(false);
  });
});

/**
 * The check costs one sign-in attempt against Supabase's limit of thirty per five minutes per
 * address, and a wrong guess costs one too. Somebody who has just been throttled must not be told
 * their password is wrong: they would go and reset a password that was correct all along.
 */
describe("when Supabase is throttling the attempt", () => {
  // PERM-42
  it("says to wait rather than that the password is wrong", async () => {
    const account = await createAccount(false);
    activeClient.value = await signInAs(account.email, ORIGINAL_PASSWORD);
    forcedVerificationError.value = {
      status: 429,
      code: "over_request_rate_limit",
      message: "Request rate limit reached",
    };

    try {
      const result = await changePassword({
        currentPassword: ORIGINAL_PASSWORD,
        newPassword: "ChosenByThem1",
        confirmPassword: "ChosenByThem1",
      });

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.message).toContain("Wait a few minutes");
        expect(result.message).not.toContain("not your current password");
        // No field error: the field is not what is wrong, and marking it would be the same lie.
        expect(result.fieldErrors).toBeUndefined();
      }
    } finally {
      forcedVerificationError.value = null;
    }

    expect(await canSignInWith(account.email, ORIGINAL_PASSWORD)).toBe(true);
  });
});
