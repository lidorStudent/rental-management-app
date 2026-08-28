import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  anonymousClient,
  SEEDED_IDS,
  SEEDED_USERS,
  profileIdFor,
  required,
  serviceRoleClient,
} from "./support/testDatabase";

/**
 * What the schema refuses on its own: DB-04 to DB-21 of the test specification.
 *
 * Every test here uses the service role, which bypasses Row Level Security and never touches an
 * action or a Zod schema. That is the point: with the application out of the way, whatever refuses
 * the write is a check constraint, a foreign key or a trigger, and those are the guarantees that
 * survive a mistake in code the way an application check cannot.
 *
 * Rows created here are removed afterwards, in the order the foreign keys allow.
 */
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

const FREE_START_DATE = "2030-01-01";
const FREE_END_DATE = "2030-12-31";

let noaProfileId: string;
let mayaProfileId: string;

const createdPaymentIds: string[] = [];
const createdRequestIds: string[] = [];
const createdLeaseIds: string[] = [];
const createdUnitIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdAccountIds: string[] = [];

function uniqueEmail(purpose: string): string {
  return `schema-${purpose}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

async function createAccount(role: "landlord" | "tenant"): Promise<string> {
  const { data, error } = await serviceRoleClient().auth.admin.createUser({
    email: uniqueEmail(role),
    password: "SchemaGuarantee1",
    email_confirm: true,
    user_metadata: { role, full_name: `Schema ${role}` },
  });

  if (error !== null || data.user === null) {
    throw new Error(`Could not create a ${role} account: ${error?.message}`);
  }

  createdAccountIds.push(data.user.id);
  return data.user.id;
}

/** A landlord with one building and one flat, owned by nobody else, safe to break. */
async function createDisposablePortfolio(): Promise<{
  landlordId: string;
  propertyId: string;
  unitId: string;
}> {
  const landlordId = await createAccount("landlord");
  const service = serviceRoleClient();

  const { data: property, error: propertyError } = await service
    .from("properties")
    .insert({
      landlord_id: landlordId,
      name: `Schema building ${Date.now()}`,
      address_line: "Constraint Street 1",
      city: "Tel Aviv-Yafo",
    })
    .select("id")
    .single();
  if (propertyError !== null) {
    throw new Error(`Could not create the property: ${propertyError.message}`);
  }
  createdPropertyIds.push(property.id);

  const { data: unit, error: unitError } = await service
    .from("units")
    .insert({
      property_id: property.id,
      landlord_id: landlordId,
      label: "Flat 1",
      bedroom_count: 2,
    })
    .select("id")
    .single();
  if (unitError !== null) {
    throw new Error(`Could not create the unit: ${unitError.message}`);
  }
  createdUnitIds.push(unit.id);

  return { landlordId, propertyId: property.id, unitId: unit.id };
}

async function createDisposableLease(
  portfolio: { landlordId: string; unitId: string },
  tenantProfileId: string | null,
): Promise<string> {
  const { data, error } = await serviceRoleClient()
    .from("leases")
    .insert({
      unit_id: portfolio.unitId,
      landlord_id: portfolio.landlordId,
      tenant_profile_id: tenantProfileId,
      rent_amount_cents: 500000,
      deposit_amount_cents: 0,
      start_date: FREE_START_DATE,
      end_date: FREE_END_DATE,
      rent_due_day: 10,
    })
    .select("id")
    .single();

  if (error !== null) {
    throw new Error(`Could not create the tenancy: ${error.message}`);
  }
  createdLeaseIds.push(data.id);
  return data.id;
}

/** The fifteenth of this month: a real date that is not the first, which is what DB-09 needs. */
function fifteenthOfThisMonth(): string {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 15))
    .toISOString()
    .slice(0, 10);
}

function firstOfThisMonth(): string {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function tomorrow(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

beforeAll(async () => {
  noaProfileId = await profileIdFor(SEEDED_USERS.landlordNoa);
  mayaProfileId = await profileIdFor(SEEDED_USERS.tenantMaya);
});

afterAll(async () => {
  const service = serviceRoleClient();

  if (createdPaymentIds.length > 0) {
    await service.from("rent_payments").delete().in("id", createdPaymentIds);
  }
  if (createdRequestIds.length > 0) {
    await service.from("maintenance_requests").delete().in("id", createdRequestIds);
  }
  if (createdLeaseIds.length > 0) {
    await service.from("leases").delete().in("id", createdLeaseIds);
  }
  if (createdUnitIds.length > 0) {
    await service.from("units").delete().in("id", createdUnitIds);
  }
  if (createdPropertyIds.length > 0) {
    await service.from("properties").delete().in("id", createdPropertyIds);
  }
  for (const accountId of createdAccountIds) {
    await service.auth.admin.deleteUser(accountId);
  }
});

describe("the constraints on a tenancy", () => {
  // DB-04
  it("refuses rent of nothing", async () => {
    const { error } = await serviceRoleClient().from("leases").insert({
      unit_id: SEEDED_IDS.unitHaNamalA,
      landlord_id: noaProfileId,
      rent_amount_cents: 0,
      start_date: FREE_START_DATE,
      end_date: FREE_END_DATE,
      rent_due_day: 10,
    });

    expect(error?.code).toBe(CHECK_VIOLATION);
    expect(error?.message).toContain("leases_rent_amount_positive");
  });

  // DB-04
  it("refuses a negative deposit", async () => {
    const { error } = await serviceRoleClient().from("leases").insert({
      unit_id: SEEDED_IDS.unitHaNamalA,
      landlord_id: noaProfileId,
      rent_amount_cents: 500000,
      deposit_amount_cents: -1,
      start_date: FREE_START_DATE,
      end_date: FREE_END_DATE,
      rent_due_day: 10,
    });

    expect(error?.code).toBe(CHECK_VIOLATION);
    expect(error?.message).toContain("leases_deposit_not_negative");
  });

  // DB-05
  it("refuses a tenancy that ends before it starts", async () => {
    const { error } = await serviceRoleClient().from("leases").insert({
      unit_id: SEEDED_IDS.unitHaNamalA,
      landlord_id: noaProfileId,
      rent_amount_cents: 500000,
      start_date: FREE_END_DATE,
      end_date: FREE_START_DATE,
      rent_due_day: 10,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("leases_end_after_start");
  });

  // DB-06
  it("refuses a rent day that does not exist in every month", async () => {
    const { error } = await serviceRoleClient().from("leases").insert({
      unit_id: SEEDED_IDS.unitHaNamalA,
      landlord_id: noaProfileId,
      rent_amount_cents: 500000,
      start_date: FREE_START_DATE,
      end_date: FREE_END_DATE,
      rent_due_day: 31,
    });

    expect(error?.code).toBe(CHECK_VIOLATION);
    expect(error?.message).toContain("leases_rent_due_day_range");
  });
});

describe("the constraints on the ledger", () => {
  // DB-07
  it("refuses a payment of nothing", async () => {
    const { error } = await serviceRoleClient().from("rent_payments").insert({
      lease_id: SEEDED_IDS.leaseMayaActive,
      landlord_id: noaProfileId,
      recorded_by: noaProfileId,
      period_month: firstOfThisMonth(),
      amount_cents: 0,
      received_on: firstOfThisMonth(),
      method: "bank_transfer",
    });

    expect(error?.code).toBe(CHECK_VIOLATION);
    expect(error?.message).toContain("rent_payments_amount_positive");
  });

  // DB-08
  it("refuses money that has not arrived yet", async () => {
    const { error } = await serviceRoleClient().from("rent_payments").insert({
      lease_id: SEEDED_IDS.leaseMayaActive,
      landlord_id: noaProfileId,
      recorded_by: noaProfileId,
      period_month: firstOfThisMonth(),
      amount_cents: 100000,
      received_on: tomorrow(),
      method: "bank_transfer",
    });

    expect(error?.code).toBe(CHECK_VIOLATION);
    expect(error?.message).toContain("rent_payments_received_on_not_future");
  });

  // DB-09
  it("refuses a period named by any day but the first of a month", async () => {
    const { error } = await serviceRoleClient().from("rent_payments").insert({
      lease_id: SEEDED_IDS.leaseMayaActive,
      landlord_id: noaProfileId,
      recorded_by: noaProfileId,
      period_month: fifteenthOfThisMonth(),
      amount_cents: 100000,
      received_on: fifteenthOfThisMonth(),
      method: "bank_transfer",
    });

    expect(error?.code).toBe(CHECK_VIOLATION);
    expect(error?.message).toContain("rent_payments_period_month_is_first_of_month");
  });
});

describe("the constraints on a reported problem", () => {
  const validRequest = {
    lease_id: SEEDED_IDS.leaseMayaActive,
    title: "A problem written only to be refused",
    description: "Long enough to satisfy the length constraint, and never stored.",
  };

  // DB-12
  it("refuses a resolved problem with no resolution date", async () => {
    const { error } = await serviceRoleClient()
      .from("maintenance_requests")
      .insert({
        ...validRequest,
        landlord_id: noaProfileId,
        submitted_by: mayaProfileId,
        status: "resolved",
        resolved_at: null,
      });

    expect(error?.code).toBe(CHECK_VIOLATION);
    expect(error?.message).toContain("maintenance_requests_resolved_at_matches_status");
  });

  // DB-12
  it("refuses a resolution date on a problem still being worked on", async () => {
    const { error } = await serviceRoleClient()
      .from("maintenance_requests")
      .insert({
        ...validRequest,
        landlord_id: noaProfileId,
        submitted_by: mayaProfileId,
        status: "in_progress",
        resolved_at: new Date().toISOString(),
      });

    expect(error?.code).toBe(CHECK_VIOLATION);
    expect(error?.message).toContain("maintenance_requests_resolved_at_matches_status");
  });

  // DB-13
  it("refuses a tenant's confirmation of a problem nobody has resolved", async () => {
    const { error } = await serviceRoleClient()
      .from("maintenance_requests")
      .insert({
        ...validRequest,
        landlord_id: noaProfileId,
        submitted_by: mayaProfileId,
        status: "submitted",
        tenant_confirmed_at: new Date().toISOString(),
      });

    expect(error?.code).toBe(CHECK_VIOLATION);
    expect(error?.message).toContain("maintenance_requests_confirmation_needs_resolution");
  });
});

describe("a flat's label", () => {
  // DB-10
  it("cannot be repeated inside one building", async () => {
    const { error } = await serviceRoleClient().from("units").insert({
      property_id: SEEDED_IDS.propertyRothschild,
      landlord_id: noaProfileId,
      label: "Flat 1",
      bedroom_count: 1,
    });

    expect(error?.code).toBe(UNIQUE_VIOLATION);
    expect(error?.message).toContain("units_label_unique_per_property");
  });

  // DB-11
  it("can be used again in a different building, because the rule is per building", async () => {
    const service = serviceRoleClient();
    const { data, error } = await service
      .from("units")
      .insert({
        property_id: SEEDED_IDS.propertyEmekRefaim,
        landlord_id: noaProfileId,
        label: "Flat 1",
        bedroom_count: 1,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    createdUnitIds.push(required(data, "the second Flat 1").id);
  });
});

describe("what a deletion takes with it, and what it may not take", () => {
  // DB-14
  it("takes the profile with the account it describes", async () => {
    const accountId = await createAccount("landlord");
    const service = serviceRoleClient();

    const { data: before } = await service
      .from("profiles")
      .select("id")
      .eq("id", accountId)
      .maybeSingle();
    expect(before).not.toBeNull();

    await service.auth.admin.deleteUser(accountId);

    const { data: after } = await service
      .from("profiles")
      .select("id")
      .eq("id", accountId)
      .maybeSingle();
    expect(after).toBeNull();
  });

  // DB-15
  it("takes a landlord's buildings and flats with their profile", async () => {
    const portfolio = await createDisposablePortfolio();
    const service = serviceRoleClient();

    await service.from("profiles").delete().eq("id", portfolio.landlordId);

    const { data: property } = await service
      .from("properties")
      .select("id")
      .eq("id", portfolio.propertyId)
      .maybeSingle();
    const { data: unit } = await service
      .from("units")
      .select("id")
      .eq("id", portfolio.unitId)
      .maybeSingle();

    expect(property).toBeNull();
    expect(unit).toBeNull();
  });

  // DB-16
  it("refuses to remove a flat that has ever been let", async () => {
    const portfolio = await createDisposablePortfolio();
    await createDisposableLease(portfolio, null);

    const { error } = await serviceRoleClient().from("units").delete().eq("id", portfolio.unitId);

    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
  });

  // DB-17
  it("refuses to remove a tenancy that has payments against it", async () => {
    const portfolio = await createDisposablePortfolio();
    const leaseId = await createDisposableLease(portfolio, null);
    const service = serviceRoleClient();

    const { data: payment, error: paymentError } = await service
      .from("rent_payments")
      .insert({
        lease_id: leaseId,
        landlord_id: portfolio.landlordId,
        recorded_by: portfolio.landlordId,
        period_month: firstOfThisMonth(),
        amount_cents: 500000,
        received_on: firstOfThisMonth(),
        method: "bank_transfer",
      })
      .select("id")
      .single();
    expect(paymentError).toBeNull();
    createdPaymentIds.push(required(payment, "the disposable payment").id);

    const { error } = await service.from("leases").delete().eq("id", leaseId);

    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
  });

  // DB-18
  it("keeps the tenancy when the tenant's account is removed, and forgets the tenant", async () => {
    const portfolio = await createDisposablePortfolio();
    const tenantId = await createAccount("tenant");
    const leaseId = await createDisposableLease(portfolio, tenantId);
    const service = serviceRoleClient();

    await service.auth.admin.deleteUser(tenantId);

    const { data: lease } = await service
      .from("leases")
      .select("id, tenant_profile_id")
      .eq("id", leaseId)
      .maybeSingle();

    expect(required(lease, "the tenancy after the account went").tenant_profile_id).toBeNull();
  });

  // DB-19
  it("refuses to remove the account of somebody who has reported a problem", async () => {
    const portfolio = await createDisposablePortfolio();
    const tenantId = await createAccount("tenant");
    const leaseId = await createDisposableLease(portfolio, tenantId);
    const service = serviceRoleClient();

    const { data: request, error: requestError } = await service
      .from("maintenance_requests")
      .insert({
        lease_id: leaseId,
        landlord_id: portfolio.landlordId,
        submitted_by: tenantId,
        title: "Reported by an account that must now survive",
        description: "Who reported a problem is part of the record, so the account cannot go.",
      })
      .select("id")
      .single();
    expect(requestError).toBeNull();
    createdRequestIds.push(required(request, "the disposable request").id);

    const { error } = await service.auth.admin.deleteUser(tenantId);

    expect(error).not.toBeNull();

    const { data: profile } = await service
      .from("profiles")
      .select("id")
      .eq("id", tenantId)
      .maybeSingle();
    expect(profile).not.toBeNull();
  });
});

describe("what the triggers maintain", () => {
  // DB-20
  it("moves updated_at without being asked", async () => {
    const portfolio = await createDisposablePortfolio();
    const service = serviceRoleClient();

    const { data: before } = await service
      .from("properties")
      .select("updated_at")
      .eq("id", portfolio.propertyId)
      .single();

    const { data: after, error } = await service
      .from("properties")
      .update({ name: "Renamed without touching updated_at" })
      .eq("id", portfolio.propertyId)
      .select("updated_at")
      .single();

    expect(error).toBeNull();
    expect(new Date(required(after, "the renamed building").updated_at).getTime()).toBeGreaterThan(
      new Date(required(before, "the building before renaming").updated_at).getTime(),
    );
  });

  // DB-21
  it("gives every new account a profile carrying the role it was created with", async () => {
    const accountId = await createAccount("tenant");

    const { data: profile } = await serviceRoleClient()
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", accountId)
      .maybeSingle();

    expect(required(profile, "the profile of the new account").role).toBe("tenant");
    expect(required(profile, "the profile of the new account").full_name).toBe("Schema tenant");
  });

  /**
   * must_change_password is the value the proxy reads to hold a tenant on the change-password page
   * until they replace the temporary password their landlord issued. It lives on a row the tenant
   * owns, and profiles_update_own lets an account write its own row, so without a trigger the
   * tenant can clear the flag with one request and walk into the portal on the landlord's password.
   * The email address is the same shape of problem: the landlord reads it to contact their tenant,
   * and it is only a copy of the address in auth.users that actually signs in.
   */
  // DB-23
  it("refuses the account itself changing must_change_password or its email address", async () => {
    const email = uniqueEmail("pinned");
    const { data: created, error: createError } = await serviceRoleClient().auth.admin.createUser({
      email,
      password: "SchemaGuarantee1",
      email_confirm: true,
      user_metadata: { role: "tenant", full_name: "Schema pinned", must_change_password: true },
    });
    if (createError !== null || created.user === null) {
      throw new Error(`Could not create the account: ${createError?.message}`);
    }
    createdAccountIds.push(created.user.id);

    const asThemselves = anonymousClient();
    const { error: signInError } = await asThemselves.auth.signInWithPassword({
      email,
      password: "SchemaGuarantee1",
    });
    expect(signInError).toBeNull();

    const clearedFlag = await asThemselves
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", created.user.id)
      .select();

    const rewrittenEmail = await asThemselves
      .from("profiles")
      .update({ email: "somebody-else@example.com" })
      .eq("id", created.user.id)
      .select();

    expect(clearedFlag.error?.code).toBe("42501");
    expect(rewrittenEmail.error?.code).toBe("42501");

    const { data: unchanged } = await serviceRoleClient()
      .from("profiles")
      .select("must_change_password, email")
      .eq("id", created.user.id)
      .maybeSingle();

    expect(required(unchanged, "the profile after the attempts").must_change_password).toBe(true);
    expect(required(unchanged, "the profile after the attempts").email).toBe(email);
  });

  /**
   * The other half of DB-22. The service role has no auth.uid(), and it is the path a landlord's
   * action takes when it issues a new temporary password and re-arms the flag, and the path the
   * change-password action takes to clear it once the password really has been replaced. Pinning
   * the columns against their owner must not pin them against that.
   */
  // DB-24
  it("still lets the service role set both, which is how the password flow re-arms them", async () => {
    const accountId = await createAccount("tenant");
    const service = serviceRoleClient();

    const rearmed = await service
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", accountId)
      .select("must_change_password")
      .maybeSingle();

    expect(rearmed.error).toBeNull();
    expect(required(rearmed.data, "the re-armed profile").must_change_password).toBe(true);

    const cleared = await service
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", accountId)
      .select("must_change_password")
      .maybeSingle();

    expect(cleared.error).toBeNull();
    expect(required(cleared.data, "the cleared profile").must_change_password).toBe(false);
  });

  /**
   * The name is deliberately not pinned. Nothing in the interface offers editing it, so this asserts
   * a choice rather than a feature: a person's own name is theirs, and refusing it would be a
   * functional restriction rather than a security fix.
   */
  // DB-25
  it("leaves the account's own name writable, which is deliberate", async () => {
    const email = uniqueEmail("named");
    const { data: created } = await serviceRoleClient().auth.admin.createUser({
      email,
      password: "SchemaGuarantee1",
      email_confirm: true,
      user_metadata: { role: "tenant", full_name: "Schema named" },
    });
    if (created.user === null) {
      throw new Error("Could not create the account");
    }
    createdAccountIds.push(created.user.id);

    const asThemselves = anonymousClient();
    await asThemselves.auth.signInWithPassword({ email, password: "SchemaGuarantee1" });

    const { error } = await asThemselves
      .from("profiles")
      .update({ full_name: "A Name They Chose" })
      .eq("id", created.user.id)
      .select();

    expect(error).toBeNull();
  });
});
