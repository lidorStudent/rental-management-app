import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

import type { Database } from "@/types/database";

import { readEnvironmentFile } from "../../tests/support/environmentFile";

/**
 * Set-up and clean-up for the end-to-end tests.
 *
 * Every test builds its own landlord, its own building and its own tenant, with an address nothing
 * else uses, and removes all of it afterwards. Nothing here touches the seeded portfolio, so the
 * tests can be run twice in a row, in any order, and do not care what the others did.
 *
 * The work is done through the admin API rather than through the interface, because setting a test
 * up through the interface makes every test depend on every screen it passes through.
 */
const environment = readEnvironmentFile(".env.test");

export const TEST_PASSWORD = "EndToEndPassword1";

export function adminClient(): SupabaseClient<Database> {
  return createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** A name nothing else in the database will collide with, however often the suite is run. */
export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export type CreatedAccount = { id: string; email: string };

export async function createLandlordAccount(): Promise<CreatedAccount> {
  return createAccount("landlord", false);
}

export async function createTenantAccount(mustChangePassword: boolean): Promise<CreatedAccount> {
  return createAccount("tenant", mustChangePassword);
}

async function createAccount(
  role: "landlord" | "tenant",
  mustChangePassword: boolean,
): Promise<CreatedAccount> {
  const email = `${uniqueName(`e2e-${role}`)}@example.co.il`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      role,
      full_name: role === "landlord" ? "Test Landlord" : "Test Tenant",
      must_change_password: mustChangePassword,
    },
  });

  if (error !== null || data.user === null) {
    throw new Error(`Could not create the ${role} account: ${error?.message}`);
  }

  return { id: data.user.id, email };
}

export type Portfolio = {
  landlord: CreatedAccount;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitLabel: string;
};

/** A landlord with one building and one unit, ready for a tenancy. */
export async function createPortfolio(): Promise<Portfolio> {
  const landlord = await createLandlordAccount();
  const admin = adminClient();
  const propertyName = uniqueName("Building");

  const { data: property, error: propertyError } = await admin
    .from("properties")
    .insert({
      landlord_id: landlord.id,
      name: propertyName,
      address_line: "Ben Yehuda Street 40",
      city: "Tel Aviv-Yafo",
    })
    .select("id")
    .single();
  if (propertyError !== null || property === null) {
    throw new Error(`Could not create the property: ${propertyError?.message}`);
  }

  const unitLabel = "Flat 1";
  const { data: unit, error: unitError } = await admin
    .from("units")
    .insert({
      property_id: property.id,
      landlord_id: landlord.id,
      label: unitLabel,
      bedroom_count: 2,
    })
    .select("id")
    .single();
  if (unitError !== null || unit === null) {
    throw new Error(`Could not create the unit: ${unitError?.message}`);
  }

  return {
    landlord,
    propertyId: property.id,
    propertyName,
    unitId: unit.id,
    unitLabel,
  };
}

export type CreatedLease = { id: string; startDate: string; endDate: string };

export async function createLease({
  portfolio,
  tenantId,
  startDate,
  endDate,
  rentAmountInAgorot = 650000,
  rentDueDay = 10,
}: {
  portfolio: Portfolio;
  tenantId: string | null;
  startDate: string;
  endDate: string;
  rentAmountInAgorot?: number;
  rentDueDay?: number;
}): Promise<CreatedLease> {
  const { data, error } = await adminClient()
    .from("leases")
    .insert({
      unit_id: portfolio.unitId,
      landlord_id: portfolio.landlord.id,
      tenant_profile_id: tenantId,
      rent_amount_cents: rentAmountInAgorot,
      deposit_amount_cents: 0,
      start_date: startDate,
      end_date: endDate,
      rent_due_day: rentDueDay,
    })
    .select("id")
    .single();

  if (error !== null || data === null) {
    throw new Error(`Could not create the lease: ${error?.message}`);
  }

  return { id: data.id, startDate, endDate };
}

export async function recordPayment({
  leaseId,
  landlordId,
  periodMonth,
  amountInAgorot,
  receivedOn,
}: {
  leaseId: string;
  landlordId: string;
  periodMonth: string;
  amountInAgorot: number;
  receivedOn: string;
}): Promise<void> {
  const { error } = await adminClient().from("rent_payments").insert({
    lease_id: leaseId,
    landlord_id: landlordId,
    recorded_by: landlordId,
    period_month: periodMonth,
    amount_cents: amountInAgorot,
    received_on: receivedOn,
    method: "bank_transfer",
    reference: "Written by the end-to-end tests",
  });

  if (error !== null) {
    throw new Error(`Could not record the payment: ${error.message}`);
  }
}

/**
 * Removes everything a test created, in the order the foreign keys allow: the rows that point at
 * others first, then the accounts. A tenant who has reported a problem cannot be deleted until the
 * problem is, which is the rule that keeps a reporter's name in the record.
 */
export async function removeEverything(
  landlordId: string,
  tenantIds: string[] = [],
): Promise<void> {
  const admin = adminClient();

  await admin.from("maintenance_requests").delete().eq("landlord_id", landlordId);
  await admin.from("rent_payments").delete().eq("landlord_id", landlordId);
  await admin.from("leases").delete().eq("landlord_id", landlordId);
  await admin.from("units").delete().eq("landlord_id", landlordId);
  await admin.from("properties").delete().eq("landlord_id", landlordId);

  for (const tenantId of tenantIds) {
    await admin.auth.admin.deleteUser(tenantId);
  }
  await admin.auth.admin.deleteUser(landlordId);
}

/** Signs in through the form, the way a person does, and waits for the area they land in. */
export async function signIn(page: Page, email: string, password = TEST_PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname === "/login");
}

/** Today and a month, in the form the date and month inputs expect. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthsFromNow(monthCount: number): string {
  const now = new Date();
  const shifted = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthCount, 1));
  return shifted.toISOString().slice(0, 10);
}

export function endOfMonth(monthCount: number): string {
  const now = new Date();
  const shifted = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthCount + 1, 0));
  return shifted.toISOString().slice(0, 10);
}
