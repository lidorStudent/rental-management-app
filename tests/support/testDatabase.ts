import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * The connection every database test uses, and the guard that keeps it off production.
 *
 * These tests sign real users in and write real rows. Pointed at the deployed project they would
 * put test tenancies into a landlord's portfolio, so the project reference is checked before a
 * single client is built and the suite refuses to start if it is the wrong one.
 */
const PRODUCTION_PROJECT_REFERENCE = "jarkqjrfuzvvrbietxve";

export const SEEDED_PASSWORD = "Demo-Rental-2026!";

export const SEEDED_USERS = {
  landlordNoa: "noa.bendavid@example.co.il",
  landlordEitan: "eitan.shapira@example.co.il",
  tenantMaya: "maya.levi@example.co.il",
  tenantYonatan: "yonatan.azoulay@example.co.il",
  tenantShira: "shira.mizrahi@example.co.il",
  tenantDana: "dana.peretz@example.co.il",
} as const;

/** The fixed identifiers the seed writes, so a test can name a row without looking it up. */
export const SEEDED_IDS = {
  propertyRothschild: "11111111-1111-4111-8111-000000000001",
  propertyEmekRefaim: "11111111-1111-4111-8111-000000000002",
  propertyHaNamal: "11111111-1111-4111-8111-000000000003",
  unitRothschildOne: "22222222-2222-4222-8222-000000000001",
  unitEmekRefaimGround: "22222222-2222-4222-8222-000000000004",
  unitEmekRefaimFirst: "22222222-2222-4222-8222-000000000005",
  unitHaNamalA: "22222222-2222-4222-8222-000000000006",
  leaseMayaActive: "33333333-3333-4333-8333-000000000001",
  leaseYonatanActive: "33333333-3333-4333-8333-000000000002",
  leaseShiraEnded: "33333333-3333-4333-8333-000000000003",
  leaseRothschildThreeUpcoming: "33333333-3333-4333-8333-000000000004",
  leaseDanaActive: "33333333-3333-4333-8333-000000000005",
} as const;

export function readTestProjectUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url === undefined || url === "") {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. These tests read .env.test; they never fall back to another project.",
    );
  }

  const projectReference = new URL(url).hostname.split(".")[0];
  if (projectReference === PRODUCTION_PROJECT_REFERENCE) {
    throw new Error(
      `REFUSING TO RUN: these tests are pointed at the production project ${projectReference}. They sign users in and write rows. Point .env.test at the test project and run them again.`,
    );
  }

  return url;
}

function readAnonymousKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (key === undefined || key === "") {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set in .env.test.");
  }
  return key;
}

function readServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (key === undefined || key === "") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set in .env.test.");
  }
  return key;
}

/** A client with no session at all: what a visitor's browser holds before signing in. */
export function anonymousClient(): SupabaseClient<Database> {
  return createClient<Database>(readTestProjectUrl(), readAnonymousKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** A client signed in as one of the seeded people, using the public key a browser would use. */
export async function signInAs(email: string): Promise<SupabaseClient<Database>> {
  const client = anonymousClient();
  const { error } = await client.auth.signInWithPassword({ email, password: SEEDED_PASSWORD });

  if (error !== null) {
    throw new Error(
      `Could not sign in as ${email}: ${error.message}. Run "npm run db:seed" against the test project first.`,
    );
  }

  return client;
}

/**
 * The service role bypasses Row Level Security entirely. It is used only to set a test up and to
 * clear up after one, never to make the assertion: a test that proved something with this client
 * would have proved nothing about the policies.
 */
export function serviceRoleClient(): SupabaseClient<Database> {
  return createClient<Database>(readTestProjectUrl(), readServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function profileIdFor(email: string): Promise<string> {
  const { data, error } = await serviceRoleClient()
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (error !== null) {
    throw new Error(`No seeded profile for ${email}: ${error.message}`);
  }
  return data.id;
}

/**
 * Narrows a value the seed is expected to have produced, with a message that says what to do when
 * it has not. The alternative is a non-null assertion, which this project forbids and which fails
 * as an unreadable TypeError three lines later.
 */
export function required<TValue>(value: TValue | null | undefined, what: string): TValue {
  if (value === null || value === undefined) {
    throw new Error(
      `${what} was not found in the test database. Run "npm run db:seed" and try again.`,
    );
  }
  return value;
}

/**
 * A service role client without the generated types.
 *
 * One test needs to ask the database about a column that does not exist, to prove it still does
 * not. The typed client cannot express that question, because its types are generated from the
 * database and already know the answer.
 */
export function untypedServiceRoleClient() {
  return createClient(readTestProjectUrl(), readServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
