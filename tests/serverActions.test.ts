import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  SEEDED_IDS,
  SEEDED_USERS,
  profileIdFor,
  required,
  serviceRoleClient,
  signInAs,
} from "./support/testDatabase";
import type { ActionResult } from "@/lib/actionResult";
import type { Database } from "@/types/database";

/**
 * The action layer, run for real against the test database.
 *
 * Only two things are replaced: the Supabase client factory, which normally reads a cookie that
 * exists only inside a request, and revalidatePath, which needs a Next.js render. Everything else is
 * the real thing, including the schemas, the ownership checks and every policy the database applies.
 *
 * These prove the second half of the claim the database tests make. The policies refuse a forged
 * write; these show that the action refuses it too, with a sentence a person can read, and that the
 * sentence does not say whether the row it refused exists.
 */
const { activeClient } = vi.hoisted(() => ({
  activeClient: { value: null as SupabaseClient<Database> | null },
}));

vi.mock("@/lib/supabase/serverClient", () => ({
  createSupabaseServerClient: async () => activeClient.value,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { createProperty, updateProperty, deleteProperty } =
  await import("@/actions/propertyActions");
const { createUnit } = await import("@/actions/unitActions");
const { createLease, endLease } = await import("@/actions/leaseActions");
const { recordRentPayment, correctRentPayment } = await import("@/actions/rentPaymentActions");
const {
  submitMaintenanceRequest,
  updateMaintenanceRequestStatus,
  confirmMaintenanceRequestResolved,
} = await import("@/actions/maintenanceRequestActions");

let noaProfileId: string;
let eitanProfileId: string;
let yonatansRequestId: string;
const propertiesToRemove: string[] = [];
const requestsToRemove: string[] = [];

async function actingAs(email: string): Promise<void> {
  activeClient.value = await signInAs(email);
}

beforeAll(async () => {
  noaProfileId = await profileIdFor(SEEDED_USERS.landlordNoa);
  eitanProfileId = await profileIdFor(SEEDED_USERS.landlordEitan);

  const { data } = await serviceRoleClient()
    .from("maintenance_requests")
    .select("id")
    .eq("lease_id", SEEDED_IDS.leaseYonatanActive)
    .limit(1)
    .single();
  yonatansRequestId = required(data, "a request on Yonatan's tenancy").id;
});

afterAll(async () => {
  if (requestsToRemove.length > 0) {
    await serviceRoleClient().from("maintenance_requests").delete().in("id", requestsToRemove);
  }
  if (propertiesToRemove.length > 0) {
    await serviceRoleClient().from("properties").delete().in("id", propertiesToRemove);
  }
});

describe("an action asked for by the wrong role", () => {
  it("refuses a tenant creating a property", async () => {
    await actingAs(SEEDED_USERS.tenantMaya);

    await expect(
      createProperty({ name: "Mine now", addressLine: "Nowhere 1", city: "Tel Aviv-Yafo" }),
    ).rejects.toThrow(/for a landlord, and the signed-in user is a tenant/);
  });

  // PERM-20
  it("refuses a tenant recording a payment", async () => {
    await actingAs(SEEDED_USERS.tenantMaya);

    await expect(
      recordRentPayment({
        leaseId: SEEDED_IDS.leaseMayaActive,
        periodMonth: "2026-08-01",
        amount: "6500",
        receivedOn: "2026-08-01",
        method: "cash",
      }),
    ).rejects.toThrow(/for a landlord/);
  });

  // PERM-23
  it("refuses a tenant moving a request along", async () => {
    await actingAs(SEEDED_USERS.tenantMaya);

    await expect(
      updateMaintenanceRequestStatus({ requestId: yonatansRequestId, nextStatus: "resolved" }),
    ).rejects.toThrow(/for a landlord/);
  });

  // CORE-24
  it("refuses a landlord reporting a problem on a tenant's behalf", async () => {
    await actingAs(SEEDED_USERS.landlordNoa);

    await expect(
      submitMaintenanceRequest({
        title: "Reported by the landlord",
        description: "A landlord must not put words in their tenant's mouth in a shared record.",
      }),
    ).rejects.toThrow(/for a tenant, and the signed-in user is a landlord/);
  });

  it("refuses a landlord confirming a fix on a tenant's behalf", async () => {
    await actingAs(SEEDED_USERS.landlordNoa);

    await expect(
      confirmMaintenanceRequestResolved({ requestId: yonatansRequestId }),
    ).rejects.toThrow(/for a tenant/);
  });
});

describe("reopening a problem the tenant had agreed was fixed", () => {
  // PROC-17
  it("clears the resolution date and the tenant's confirmation", async () => {
    await actingAs(SEEDED_USERS.tenantYonatan);
    const reported = await submitMaintenanceRequest({
      title: "The problem that comes back",
      description: "Reported so that the reopening rule can be driven from end to end.",
    });
    if (reported.status !== "success") {
      throw new Error(`Could not report the problem: ${reported.message}`);
    }
    const requestId = reported.value.requestId;
    requestsToRemove.push(requestId);

    await actingAs(SEEDED_USERS.landlordNoa);
    expectOk(await updateMaintenanceRequestStatus({ requestId, nextStatus: "resolved" }));

    await actingAs(SEEDED_USERS.tenantYonatan);
    expectOk(await confirmMaintenanceRequestResolved({ requestId }));

    const afterConfirming = await readRequest(requestId);
    expect(afterConfirming.status).toBe("resolved");
    expect(afterConfirming.resolved_at).not.toBeNull();
    expect(afterConfirming.tenant_confirmed_at).not.toBeNull();

    // The landlord reopens it. A problem that came back was never finished, so the tenant's
    // agreement that it was does not survive the reopening.
    await actingAs(SEEDED_USERS.landlordNoa);
    expectOk(await updateMaintenanceRequestStatus({ requestId, nextStatus: "in_progress" }));

    const afterReopening = await readRequest(requestId);
    expect(afterReopening.status).toBe("in_progress");
    expect(afterReopening.resolved_at).toBeNull();
    expect(afterReopening.tenant_confirmed_at).toBeNull();
  });
});

function expectOk(result: ActionResult<{ requestId: string }>): void {
  if (result.status !== "success") {
    throw new Error(`The action was refused: ${result.message}`);
  }
}

/**
 * Read back with the service role rather than through the action, because the assertion is about
 * what is in the row and not about what a caller is allowed to see of it.
 */
async function readRequest(requestId: string) {
  const { data } = await serviceRoleClient()
    .from("maintenance_requests")
    .select("status, resolved_at, tenant_confirmed_at")
    .eq("id", requestId)
    .maybeSingle();

  return required(data, `the maintenance request ${requestId}`);
}

describe("an action given another landlord's identifier", () => {
  it("answers a property that is not theirs exactly as it answers one that does not exist", async () => {
    await actingAs(SEEDED_USERS.landlordEitan);

    const somebodyElses = await updateProperty({
      propertyId: SEEDED_IDS.propertyRothschild,
      name: "Taken over",
      addressLine: "Rothschild Boulevard 12",
      city: "Tel Aviv-Yafo",
    });
    const nobodys = await updateProperty({
      propertyId: "11111111-2222-4333-8444-555555555555",
      name: "Taken over",
      addressLine: "Rothschild Boulevard 12",
      city: "Tel Aviv-Yafo",
    });

    expect(somebodyElses).toEqual({ status: "error", message: "That property was not found." });
    expect(nobodys).toEqual(somebodyElses);
  });

  // PERM-07
  it("refuses to delete another landlord's property, and does not delete it", async () => {
    await actingAs(SEEDED_USERS.landlordEitan);

    const result = await deleteProperty({ propertyId: SEEDED_IDS.propertyEmekRefaim });

    expect(result).toEqual({ status: "error", message: "That property was not found." });
    const { data } = await serviceRoleClient()
      .from("properties")
      .select("id")
      .eq("id", SEEDED_IDS.propertyEmekRefaim);
    expect(data).toHaveLength(1);
  });

  // PERM-08
  it("refuses a unit added to another landlord's building", async () => {
    await actingAs(SEEDED_USERS.landlordEitan);

    const result = await createUnit({
      propertyId: SEEDED_IDS.propertyRothschild,
      label: "Smuggled",
    });

    expect(result).toEqual({ status: "error", message: "That property was not found." });
  });

  // INV-33
  it("refuses a tenancy on another landlord's unit", async () => {
    await actingAs(SEEDED_USERS.landlordEitan);

    const result = await createLease({
      unitId: SEEDED_IDS.unitRothschildOne,
      startDate: "2030-01-01",
      endDate: "2030-12-31",
      rentAmount: "6500",
      rentDueDay: 1,
    });

    expect(result).toEqual({ status: "error", message: "That unit was not found." });
  });

  // PERM-09
  it("refuses a payment recorded against another landlord's tenancy", async () => {
    await actingAs(SEEDED_USERS.landlordEitan);

    const result = await recordRentPayment({
      leaseId: SEEDED_IDS.leaseMayaActive,
      periodMonth: "2026-08-01",
      amount: "6500",
      receivedOn: "2026-08-01",
      method: "cash",
    });

    expect(result).toEqual({ status: "error", message: "That lease was not found." });
  });

  // INV-44
  it("refuses a correction to another landlord's payment", async () => {
    const { data: payment } = await serviceRoleClient()
      .from("rent_payments")
      .select("id")
      .eq("lease_id", SEEDED_IDS.leaseMayaActive)
      .limit(1)
      .single();

    await actingAs(SEEDED_USERS.landlordEitan);

    const result = await correctRentPayment({
      paymentId: required(payment, "a payment on Maya's tenancy").id,
      periodMonth: "2026-08-01",
      amount: "1",
      receivedOn: "2026-08-01",
      method: "cash",
    });

    expect(result).toEqual({ status: "error", message: "That payment was not found." });
  });

  it("refuses ending another landlord's tenancy", async () => {
    await actingAs(SEEDED_USERS.landlordEitan);

    const result = await endLease({ leaseId: SEEDED_IDS.leaseMayaActive, endDate: "2026-06-30" });

    expect(result).toEqual({ status: "error", message: "That lease was not found." });
  });

  // PERM-16
  it("refuses a tenant confirming another tenant's request, in the same words as a missing one", async () => {
    await actingAs(SEEDED_USERS.tenantMaya);

    const somebodyElses = await confirmMaintenanceRequestResolved({ requestId: yonatansRequestId });
    const nobodys = await confirmMaintenanceRequestResolved({
      requestId: "11111111-2222-4333-8444-555555555555",
    });

    expect(somebodyElses).toEqual({ status: "error", message: "That request was not found." });
    expect(nobodys).toEqual(somebodyElses);
  });
});

/**
 * No action takes an owner from its input. The proof is that there is nowhere to put one: the
 * property created here names no landlord at all, and the row comes out owned by the acting user.
 */
describe("where ownership comes from", () => {
  // CORE-02
  it("stamps a new property with the acting landlord, not with anything sent", async () => {
    await actingAs(SEEDED_USERS.landlordEitan);

    const result = await createProperty({
      name: "Written by the action tests",
      addressLine: "Test Street 1",
      city: "Haifa",
    });

    expect(result.status).toBe("success");
    const propertyId = result.status === "success" ? result.value.propertyId : "";
    propertiesToRemove.push(propertyId);

    const { data } = await serviceRoleClient()
      .from("properties")
      .select("landlord_id")
      .eq("id", propertyId)
      .single();

    expect(data?.landlord_id).toBe(eitanProfileId);
    expect(data?.landlord_id).not.toBe(noaProfileId);
  });

  // CORE-18
  it("stamps a payment with the landlord who recorded it", async () => {
    await actingAs(SEEDED_USERS.landlordNoa);

    // Derived from the tenancy rather than written down. The seed places its leases relative to the
    // day it runs, so a fixed month is only inside the lease while the project was seeded within a
    // particular window; outside it the action refuses the month and this test fails complaining
    // about ownership stamping, which is not what it is about.
    const { data: lease } = await serviceRoleClient()
      .from("leases")
      .select("start_date")
      .eq("id", SEEDED_IDS.leaseMayaActive)
      .single();
    const firstMonthOfTheTenancy = `${required(lease, "Maya's tenancy").start_date.slice(0, 7)}-01`;

    const result = await recordRentPayment({
      leaseId: SEEDED_IDS.leaseMayaActive,
      periodMonth: firstMonthOfTheTenancy,
      amount: "1",
      receivedOn: required(lease, "Maya's tenancy").start_date,
      method: "cash",
      reference: "Written by the action tests",
    });

    expect(result.status).toBe("success");
    const paymentId = result.status === "success" ? result.value.paymentId : "";

    const service = serviceRoleClient();
    const { data } = await service
      .from("rent_payments")
      .select("landlord_id, recorded_by")
      .eq("id", paymentId)
      .single();

    expect(data?.landlord_id).toBe(noaProfileId);
    expect(data?.recorded_by).toBe(noaProfileId);

    await service.from("rent_payments").delete().eq("id", paymentId);
  });
});

/**
 * The rules a landlord meets on their own rows.
 *
 * Every case here acts as the landlord who owns the lease, because that is the only way the rule is
 * reached: the action resolves the row first and answers "not found" to anybody else, so a test
 * acting as the wrong landlord exercises the ownership check and never the rule behind it. That is
 * why these four rules went untested while an authorisation test that looked like them passed.
 *
 * Nothing here writes. Each call is refused, so each leaves the database as it found it.
 */
describe("the rules a landlord meets on a row they own", () => {
  // INV-34
  it("refuses an end date later than the one the lease already has", async () => {
    await actingAs(SEEDED_USERS.landlordNoa);

    const { data: lease } = await serviceRoleClient()
      .from("leases")
      .select("start_date, end_date")
      .eq("id", SEEDED_IDS.leaseMayaActive)
      .single();
    const existing = required(lease, "Maya's tenancy");

    const result = await endLease({
      leaseId: SEEDED_IDS.leaseMayaActive,
      endDate: shiftIsoDate(existing.end_date, 1),
    });

    expect(result).toEqual({
      status: "error",
      message: "Ending a lease brings its end date forward.",
      fieldErrors: {
        endDate: `This lease already ends on ${existing.end_date}. To extend it, renew it instead.`,
      },
    });
  });

  // INV-35
  it("refuses an end date on the day the lease started", async () => {
    await actingAs(SEEDED_USERS.landlordNoa);

    const { data: lease } = await serviceRoleClient()
      .from("leases")
      .select("start_date")
      .eq("id", SEEDED_IDS.leaseMayaActive)
      .single();
    const existing = required(lease, "Maya's tenancy");

    const result = await endLease({
      leaseId: SEEDED_IDS.leaseMayaActive,
      endDate: existing.start_date,
    });

    expect(result).toEqual({
      status: "error",
      message: "A tenancy must end after it started.",
      fieldErrors: { endDate: `This lease began on ${existing.start_date}.` },
    });
  });

  // INV-40
  it("refuses rent recorded against a month the tenancy does not cover", async () => {
    await actingAs(SEEDED_USERS.landlordNoa);

    const { data: lease } = await serviceRoleClient()
      .from("leases")
      .select("start_date, end_date")
      .eq("id", SEEDED_IDS.leaseMayaActive)
      .single();
    const existing = required(lease, "Maya's tenancy");

    // The month before the tenancy began, derived from it rather than named, so this stays outside
    // the lease however far the seed slides it.
    const monthBefore = `${shiftIsoDate(existing.start_date, -1).slice(0, 7)}-01`;

    const result = await recordRentPayment({
      leaseId: SEEDED_IDS.leaseMayaActive,
      periodMonth: monthBefore,
      amount: "6500",
      receivedOn: existing.start_date,
      method: "cash",
    });

    expect(result).toEqual({
      status: "error",
      message: "That month is outside this tenancy.",
      fieldErrors: {
        periodMonth: `This lease runs from ${existing.start_date} to ${existing.end_date}.`,
      },
    });
  });

  // INV-49
  it("refuses a status the transition map does not allow from the one the request has", async () => {
    await actingAs(SEEDED_USERS.landlordNoa);

    const { data: request } = await serviceRoleClient()
      .from("maintenance_requests")
      .select("id, status")
      .eq("landlord_id", noaProfileId)
      .eq("status", "in_progress")
      .limit(1)
      .single();

    const result = await updateMaintenanceRequestStatus({
      requestId: required(request, "a request of Noa's that is in progress").id,
      nextStatus: "submitted",
    });

    expect(result).toEqual({
      status: "error",
      message: "A request that is in progress can only become resolved.",
    });
  });
});

/**
 * An ISO date shifted by whole days. Local rather than imported from `src/lib/dates`, because this
 * suite reaches the database and the actions without the rest of the application in between.
 */
function shiftIsoDate(isoDate: string, dayCount: number): string {
  const shifted = new Date(`${isoDate}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + dayCount);
  return shifted.toISOString().slice(0, 10);
}
