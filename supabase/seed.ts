/**
 * Seeds a Supabase project with a small, plausible portfolio: two landlords who share no data, four
 * tenants, leases in every lifecycle state, a rent ledger that produces a paid, a partial and an
 * overdue month, and maintenance requests in every status.
 *
 * It is written in TypeScript and run with Node rather than as plain SQL because the accounts have
 * to be created through the Supabase Auth admin API. Inserting into auth.users by hand means
 * reproducing password hashing and half a dozen internal columns, and getting any of it wrong
 * produces an account that exists but cannot sign in.
 *
 * Usage:
 *   npm run db:seed                 seeds the project named in .env.test
 *   npm run db:seed:production      seeds the project named in .env.local, with confirmation
 *
 * The script is idempotent. Accounts are created only if their email address is not already
 * registered, the portfolio rows are upserted by fixed identifier, and the ledger and the
 * maintenance requests are rebuilt from scratch on every run.
 */

import { createClient } from "@supabase/supabase-js";

const PRODUCTION_PROJECT_REFERENCE = "jarkqjrfuzvvrbietxve";
const PRODUCTION_CONFIRMATION_FLAG = "--confirm-production";

const supabaseUrl = readRequiredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = readRequiredEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY");
const seedUserPassword = process.env.SEED_USER_PASSWORD ?? "Demo-Rental-2026!";

// The service role bypasses Row Level Security, which is the only way to write rows on behalf of
// several different owners in one pass. Nothing else in this project uses it this broadly.
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type SeedRole = "landlord" | "tenant";

type SeedPerson = {
  key: string;
  email: string;
  fullName: string;
  role: SeedRole;
};

type RentPaymentRow = {
  lease_id: string;
  landlord_id: string;
  recorded_by: string;
  period_month: string;
  amount_cents: number;
  received_on: string;
  method: "bank_transfer" | "cash" | "cheque" | "card" | "other";
  reference: string | null;
};

const people: SeedPerson[] = [
  {
    key: "landlordNoa",
    email: "noa.bendavid@example.co.il",
    fullName: "Noa Ben-David",
    role: "landlord",
  },
  {
    key: "landlordEitan",
    email: "eitan.shapira@example.co.il",
    fullName: "Eitan Shapira",
    role: "landlord",
  },
  { key: "tenantMaya", email: "maya.levi@example.co.il", fullName: "Maya Levi", role: "tenant" },
  {
    key: "tenantYonatan",
    email: "yonatan.azoulay@example.co.il",
    fullName: "Yonatan Azoulay",
    role: "tenant",
  },
  {
    key: "tenantShira",
    email: "shira.mizrahi@example.co.il",
    fullName: "Shira Mizrahi",
    role: "tenant",
  },
  {
    key: "tenantDana",
    email: "dana.peretz@example.co.il",
    fullName: "Dana Peretz",
    role: "tenant",
  },
];

// Fixed identifiers keep the seed idempotent: a second run updates the same rows instead of
// creating a second portfolio.
const identifiers = {
  propertyRothschild: "11111111-1111-4111-8111-000000000001",
  propertyEmekRefaim: "11111111-1111-4111-8111-000000000002",
  propertyHaNamal: "11111111-1111-4111-8111-000000000003",
  unitRothschildOne: "22222222-2222-4222-8222-000000000001",
  unitRothschildTwo: "22222222-2222-4222-8222-000000000002",
  unitRothschildThree: "22222222-2222-4222-8222-000000000003",
  unitEmekRefaimGround: "22222222-2222-4222-8222-000000000004",
  unitEmekRefaimFirst: "22222222-2222-4222-8222-000000000005",
  unitHaNamalA: "22222222-2222-4222-8222-000000000006",
  unitHaNamalB: "22222222-2222-4222-8222-000000000007",
  leaseMayaActive: "33333333-3333-4333-8333-000000000001",
  leaseYonatanActive: "33333333-3333-4333-8333-000000000002",
  leaseShiraEnded: "33333333-3333-4333-8333-000000000003",
  leaseRothschildThreeUpcoming: "33333333-3333-4333-8333-000000000004",
  leaseDanaActive: "33333333-3333-4333-8333-000000000005",
};

const today = new Date();

function readRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(
      `${name} is not set. Run the seed through "npm run db:seed", which loads .env.test, or ` +
        `"npm run db:seed:production", which loads .env.local.`,
    );
  }
  return value;
}

function projectReferenceFromUrl(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
}

function refuseProductionWithoutConfirmation(): void {
  const targetProjectReference = projectReferenceFromUrl(supabaseUrl);
  const isProduction = targetProjectReference === PRODUCTION_PROJECT_REFERENCE;
  const isConfirmed = process.argv.includes(PRODUCTION_CONFIRMATION_FLAG);

  if (isProduction && !isConfirmed) {
    console.error(
      `Refusing to seed the production project ${targetProjectReference}. ` +
        `Re-run with ${PRODUCTION_CONFIRMATION_FLAG} if that is really what you want.`,
    );
    process.exit(1);
  }
}

function startOfMonth(monthOffset: number): Date {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + monthOffset, 1));
}

function endOfMonth(monthOffset: number): Date {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + monthOffset + 1, 0));
}

function dayInMonth(monthOffset: number, dayOfMonth: number): Date {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + monthOffset, dayOfMonth));
}

function daysAgo(numberOfDays: number): Date {
  return new Date(Date.now() - numberOfDays * 24 * 60 * 60 * 1000);
}

function asDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function shekelsToAgorot(amountInShekels: number): number {
  return Math.round(amountInShekels * 100);
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const usersPerPage = 200;
  let page = 1;

  for (;;) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: usersPerPage });
    if (error) {
      throw error;
    }
    const match = data.users.find((user) => user.email === email);
    if (match) {
      return match.id;
    }
    if (data.users.length < usersPerPage) {
      return null;
    }
    page += 1;
  }
}

/**
 * The profile row itself is created by the create_profile_for_new_auth_user trigger, which reads
 * the role and the name out of the signup metadata. Seeded tenants are marked as having already
 * chosen their own password, so that they can be signed in with directly.
 */
async function ensureAccount(person: SeedPerson): Promise<string> {
  const existingUserId = await findAuthUserIdByEmail(person.email);

  if (existingUserId !== null) {
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ full_name: person.fullName, email: person.email, must_change_password: false })
      .eq("id", existingUserId);
    if (profileError) {
      throw profileError;
    }
    return existingUserId;
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email: person.email,
    password: seedUserPassword,
    email_confirm: true,
    user_metadata: {
      role: person.role,
      full_name: person.fullName,
      must_change_password: false,
    },
  });
  if (error) {
    throw error;
  }
  return data.user.id;
}

async function upsertRows(table: string, rows: object[]): Promise<void> {
  const { error } = await adminClient.from(table).upsert(rows, { onConflict: "id" });
  if (error) {
    throw new Error(`Could not upsert into ${table}: ${error.message}`);
  }
}

async function replaceRowsForLeases(
  table: string,
  leaseIds: string[],
  rows: object[],
): Promise<void> {
  const { error: deleteError } = await adminClient.from(table).delete().in("lease_id", leaseIds);
  if (deleteError) {
    throw new Error(`Could not clear ${table}: ${deleteError.message}`);
  }
  if (rows.length === 0) {
    return;
  }
  const { error: insertError } = await adminClient.from(table).insert(rows);
  if (insertError) {
    throw new Error(`Could not insert into ${table}: ${insertError.message}`);
  }
}

/** One full rent payment per month across an inclusive range of month offsets from this month. */
function monthlyRentPayments(options: {
  leaseId: string;
  landlordId: string;
  amountInAgorot: number;
  rentDueDay: number;
  fromMonthOffset: number;
  toMonthOffset: number;
  reference: string;
}): RentPaymentRow[] {
  const payments: RentPaymentRow[] = [];

  for (
    let monthOffset = options.fromMonthOffset;
    monthOffset <= options.toMonthOffset;
    monthOffset += 1
  ) {
    payments.push({
      lease_id: options.leaseId,
      landlord_id: options.landlordId,
      recorded_by: options.landlordId,
      period_month: asDate(startOfMonth(monthOffset)),
      amount_cents: options.amountInAgorot,
      received_on: asDate(dayInMonth(monthOffset, options.rentDueDay)),
      method: "bank_transfer",
      reference: options.reference,
    });
  }

  return payments;
}

type PortfolioAccounts = {
  landlordNoaId: string;
  landlordEitanId: string;
  tenantMayaId: string;
  tenantYonatanId: string;
  tenantShiraId: string;
  tenantDanaId: string;
};

const seededLeaseIds = [
  identifiers.leaseMayaActive,
  identifiers.leaseYonatanActive,
  identifiers.leaseShiraEnded,
  identifiers.leaseRothschildThreeUpcoming,
  identifiers.leaseDanaActive,
];

async function createAccounts(): Promise<PortfolioAccounts> {
  const accountIds = new Map<string, string>();
  for (const person of people) {
    accountIds.set(person.key, await ensureAccount(person));
  }

  return {
    landlordNoaId: requireAccountId(accountIds, "landlordNoa"),
    landlordEitanId: requireAccountId(accountIds, "landlordEitan"),
    tenantMayaId: requireAccountId(accountIds, "tenantMaya"),
    tenantYonatanId: requireAccountId(accountIds, "tenantYonatan"),
    tenantShiraId: requireAccountId(accountIds, "tenantShira"),
    tenantDanaId: requireAccountId(accountIds, "tenantDana"),
  };
}

function buildProperties(accounts: PortfolioAccounts): object[] {
  return [
    {
      id: identifiers.propertyRothschild,
      landlord_id: accounts.landlordNoaId,
      name: "Rothschild 12",
      address_line: "Rothschild Boulevard 12",
      city: "Tel Aviv-Yafo",
      postal_code: "6688212",
    },
    {
      id: identifiers.propertyEmekRefaim,
      landlord_id: accounts.landlordNoaId,
      name: "Emek Refaim 21",
      address_line: "Emek Refaim Street 21",
      city: "Jerusalem",
      postal_code: "9314101",
    },
    {
      id: identifiers.propertyHaNamal,
      landlord_id: accounts.landlordEitanId,
      name: "HaNamal 5",
      address_line: "HaNamal Street 5",
      city: "Haifa",
      postal_code: "3303152",
    },
  ];
}

function buildUnits(accounts: PortfolioAccounts): object[] {
  const noa = accounts.landlordNoaId;
  const eitan = accounts.landlordEitanId;

  return [
    {
      id: identifiers.unitRothschildOne,
      property_id: identifiers.propertyRothschild,
      landlord_id: noa,
      label: "Flat 1",
      bedroom_count: 3,
    },
    {
      id: identifiers.unitRothschildTwo,
      property_id: identifiers.propertyRothschild,
      landlord_id: noa,
      label: "Flat 2",
      bedroom_count: 2,
    },
    {
      id: identifiers.unitRothschildThree,
      property_id: identifiers.propertyRothschild,
      landlord_id: noa,
      label: "Flat 3",
      bedroom_count: 4,
    },
    {
      id: identifiers.unitEmekRefaimGround,
      property_id: identifiers.propertyEmekRefaim,
      landlord_id: noa,
      label: "Ground floor",
      bedroom_count: 2,
    },
    {
      id: identifiers.unitEmekRefaimFirst,
      property_id: identifiers.propertyEmekRefaim,
      landlord_id: noa,
      label: "First floor",
      bedroom_count: 3,
    },
    {
      id: identifiers.unitHaNamalA,
      property_id: identifiers.propertyHaNamal,
      landlord_id: eitan,
      label: "Flat A",
      bedroom_count: 2,
    },
    {
      id: identifiers.unitHaNamalB,
      property_id: identifiers.propertyHaNamal,
      landlord_id: eitan,
      label: "Flat B",
      bedroom_count: 3,
    },
  ];
}

function buildLeases(accounts: PortfolioAccounts): object[] {
  return [
    {
      // Active. Paid up to two months ago, nothing since, so last month reads overdue.
      id: identifiers.leaseMayaActive,
      unit_id: identifiers.unitRothschildOne,
      landlord_id: accounts.landlordNoaId,
      tenant_profile_id: accounts.tenantMayaId,
      rent_amount_cents: shekelsToAgorot(6500),
      deposit_amount_cents: shekelsToAgorot(13000),
      start_date: asDate(startOfMonth(-8)),
      end_date: asDate(endOfMonth(4)),
      rent_due_day: 10,
    },
    {
      // Active. Part paid for the current period, which is not due yet.
      id: identifiers.leaseYonatanActive,
      unit_id: identifiers.unitRothschildTwo,
      landlord_id: accounts.landlordNoaId,
      tenant_profile_id: accounts.tenantYonatanId,
      rent_amount_cents: shekelsToAgorot(5800),
      deposit_amount_cents: shekelsToAgorot(11600),
      start_date: asDate(startOfMonth(-5)),
      end_date: asDate(endOfMonth(7)),
      rent_due_day: 28,
    },
    {
      // Ended two months ago, fully paid. The tenant keeps access to their own history.
      id: identifiers.leaseShiraEnded,
      unit_id: identifiers.unitRothschildThree,
      landlord_id: accounts.landlordNoaId,
      tenant_profile_id: accounts.tenantShiraId,
      rent_amount_cents: shekelsToAgorot(6200),
      deposit_amount_cents: shekelsToAgorot(12400),
      start_date: asDate(startOfMonth(-14)),
      end_date: asDate(endOfMonth(-2)),
      rent_due_day: 5,
    },
    {
      // Upcoming, and recorded before the tenant's account exists. Does not overlap the ended
      // lease above, which the exclusion constraint would refuse.
      id: identifiers.leaseRothschildThreeUpcoming,
      unit_id: identifiers.unitRothschildThree,
      landlord_id: accounts.landlordNoaId,
      tenant_profile_id: null,
      rent_amount_cents: shekelsToAgorot(6900),
      deposit_amount_cents: shekelsToAgorot(13800),
      start_date: asDate(startOfMonth(1)),
      end_date: asDate(endOfMonth(13)),
      rent_due_day: 1,
    },
    {
      // The second landlord's only tenancy, used to prove that neither landlord can see the other.
      id: identifiers.leaseDanaActive,
      unit_id: identifiers.unitHaNamalA,
      landlord_id: accounts.landlordEitanId,
      tenant_profile_id: accounts.tenantDanaId,
      rent_amount_cents: shekelsToAgorot(4900),
      deposit_amount_cents: shekelsToAgorot(9800),
      start_date: asDate(startOfMonth(-3)),
      end_date: asDate(endOfMonth(9)),
      rent_due_day: 15,
    },
  ];
}

function buildRentPayments(accounts: PortfolioAccounts): RentPaymentRow[] {
  // The partial payment lands on the current period while that period is still ahead of its due
  // day, so that the schedule shows a genuine partial rather than an underpaid overdue month.
  const partialPeriodOffset = today.getUTCDate() <= 27 ? 0 : 1;

  return [
    ...monthlyRentPayments({
      leaseId: identifiers.leaseMayaActive,
      landlordId: accounts.landlordNoaId,
      amountInAgorot: shekelsToAgorot(6500),
      rentDueDay: 10,
      fromMonthOffset: -8,
      toMonthOffset: -2,
      reference: "Standing order 4471",
    }),
    ...monthlyRentPayments({
      leaseId: identifiers.leaseYonatanActive,
      landlordId: accounts.landlordNoaId,
      amountInAgorot: shekelsToAgorot(5800),
      rentDueDay: 28,
      fromMonthOffset: -5,
      toMonthOffset: -1,
      reference: "Transfer 8820",
    }),
    {
      lease_id: identifiers.leaseYonatanActive,
      landlord_id: accounts.landlordNoaId,
      recorded_by: accounts.landlordNoaId,
      period_month: asDate(startOfMonth(partialPeriodOffset)),
      amount_cents: shekelsToAgorot(2500),
      received_on: asDate(daysAgo(2)),
      method: "cash",
      reference: "Part payment, rest promised on payday",
    },
    ...monthlyRentPayments({
      leaseId: identifiers.leaseShiraEnded,
      landlordId: accounts.landlordNoaId,
      amountInAgorot: shekelsToAgorot(6200),
      rentDueDay: 5,
      fromMonthOffset: -14,
      toMonthOffset: -2,
      reference: "Standing order 1192",
    }),
    ...monthlyRentPayments({
      leaseId: identifiers.leaseDanaActive,
      landlordId: accounts.landlordEitanId,
      amountInAgorot: shekelsToAgorot(4900),
      rentDueDay: 15,
      fromMonthOffset: -3,
      toMonthOffset: -1,
      reference: "Transfer 3308",
    }),
  ];
}

function buildMaintenanceRequests(accounts: PortfolioAccounts): object[] {
  return [
    {
      lease_id: identifiers.leaseMayaActive,
      landlord_id: accounts.landlordNoaId,
      submitted_by: accounts.tenantMayaId,
      title: "Kitchen tap drips constantly",
      description:
        "The mixer tap in the kitchen drips even when closed tightly. It has been getting worse over the past two weeks.",
      urgency: "normal",
      status: "in_progress",
      created_at: daysAgo(18).toISOString(),
      resolved_at: null,
    },
    {
      lease_id: identifiers.leaseMayaActive,
      landlord_id: accounts.landlordNoaId,
      submitted_by: accounts.tenantMayaId,
      title: "No hot water in the shower",
      description:
        "The boiler stopped heating on Friday evening. There is hot water in the kitchen sink but not in the bathroom.",
      urgency: "urgent",
      status: "resolved",
      created_at: daysAgo(40).toISOString(),
      resolved_at: daysAgo(36).toISOString(),
    },
    {
      lease_id: identifiers.leaseYonatanActive,
      landlord_id: accounts.landlordNoaId,
      submitted_by: accounts.tenantYonatanId,
      title: "Front door lock sticks",
      description:
        "The key needs to be forced to turn in the front door lock, and twice this week it did not turn at all.",
      urgency: "normal",
      status: "submitted",
      created_at: daysAgo(3).toISOString(),
      resolved_at: null,
    },
    {
      lease_id: identifiers.leaseYonatanActive,
      landlord_id: accounts.landlordNoaId,
      submitted_by: accounts.tenantYonatanId,
      title: "Bedroom air conditioner is not cooling",
      description:
        "The unit runs and the fan works, but the air coming out is not cold. The bedroom does not cool down at night.",
      urgency: "urgent",
      status: "acknowledged",
      created_at: daysAgo(9).toISOString(),
      resolved_at: null,
    },
    {
      lease_id: identifiers.leaseDanaActive,
      landlord_id: accounts.landlordEitanId,
      submitted_by: accounts.tenantDanaId,
      title: "Water stain spreading on the living room ceiling",
      description:
        "A damp patch appeared on the living room ceiling after the rain last week and it has grown since then.",
      urgency: "urgent",
      status: "submitted",
      created_at: daysAgo(5).toISOString(),
      resolved_at: null,
    },
  ];
}

async function seed(): Promise<void> {
  refuseProductionWithoutConfirmation();

  const accounts = await createAccounts();

  await upsertRows("properties", buildProperties(accounts));
  await upsertRows("units", buildUnits(accounts));
  await upsertRows("leases", buildLeases(accounts));
  await replaceRowsForLeases("rent_payments", seededLeaseIds, buildRentPayments(accounts));
  await replaceRowsForLeases(
    "maintenance_requests",
    seededLeaseIds,
    buildMaintenanceRequests(accounts),
  );

  await reportWhatLanded();
}

function requireAccountId(accountIds: Map<string, string>, key: string): string {
  const accountId = accountIds.get(key);
  if (accountId === undefined) {
    throw new Error(`No account was created for ${key}.`);
  }
  return accountId;
}

async function reportWhatLanded(): Promise<void> {
  const tables = [
    "profiles",
    "properties",
    "units",
    "leases",
    "rent_payments",
    "maintenance_requests",
  ];
  const counts: string[] = [];

  for (const table of tables) {
    const { count, error } = await adminClient
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) {
      throw error;
    }
    counts.push(`${table}: ${count}`);
  }

  console.warn(`Seeded ${projectReferenceFromUrl(supabaseUrl)}. ${counts.join(", ")}`);
}

seed().catch((failure: unknown) => {
  console.error(failure instanceof Error ? failure.message : failure);
  process.exit(1);
});
