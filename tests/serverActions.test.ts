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

  it("refuses a tenant moving a request along", async () => {
    await actingAs(SEEDED_USERS.tenantMaya);

    await expect(
      updateMaintenanceRequestStatus({ requestId: yonatansRequestId, nextStatus: "resolved" }),
    ).rejects.toThrow(/for a landlord/);
  });

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

  it("refuses a unit added to another landlord's building", async () => {
    await actingAs(SEEDED_USERS.landlordEitan);

    const result = await createUnit({
      propertyId: SEEDED_IDS.propertyRothschild,
      label: "Smuggled",
    });

    expect(result).toEqual({ status: "error", message: "That property was not found." });
  });

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

  it("stamps a payment with the landlord who recorded it", async () => {
    await actingAs(SEEDED_USERS.landlordNoa);

    const result = await recordRentPayment({
      leaseId: SEEDED_IDS.leaseMayaActive,
      periodMonth: "2026-08-01",
      amount: "1",
      receivedOn: "2026-08-01",
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
