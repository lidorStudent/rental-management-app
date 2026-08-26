import { describe, expect, it } from "vitest";

import {
  confirmMaintenanceResolutionSchema,
  submitMaintenanceRequestSchema,
  updateMaintenanceRequestStatusSchema,
} from "@/lib/validation/maintenanceSchemas";

const REQUEST_ID = "3f6d8f7a-1b2c-4d3e-8f90-1a2b3c4d5e6f";
const VALID_REQUEST = {
  title: "Kitchen tap drips",
  description: "The mixer tap drips even when closed tightly, and it is getting worse.",
  urgency: "normal",
};

describe("submitMaintenanceRequestSchema", () => {
  it("accepts a reported problem", () => {
    expect(submitMaintenanceRequestSchema.safeParse(VALID_REQUEST).success).toBe(true);
  });

  it("treats an unstated urgency as normal", () => {
    expect(
      submitMaintenanceRequestSchema.parse({ ...VALID_REQUEST, urgency: undefined }).urgency,
    ).toBe("normal");
  });

  it("carries no lease, because the tenant's tenancy comes from their session", () => {
    const parsed = submitMaintenanceRequestSchema.parse({
      ...VALID_REQUEST,
      leaseId: "somebody-elses",
    });

    expect(parsed).not.toHaveProperty("leaseId");
  });

  it("refuses a title too short to recognise in a list", () => {
    expect(
      submitMaintenanceRequestSchema.safeParse({ ...VALID_REQUEST, title: "Ta" }).success,
    ).toBe(false);
  });

  it("refuses a title longer than the database column allows", () => {
    expect(
      submitMaintenanceRequestSchema.safeParse({ ...VALID_REQUEST, title: "T".repeat(121) })
        .success,
    ).toBe(false);
  });

  /**
   * INV-46. "broken" gives a landlord nothing to act on, and a request nobody can act on is the
   * failure this product exists to remove.
   */
  it("refuses a description too short to act on", () => {
    expect(
      submitMaintenanceRequestSchema.safeParse({ ...VALID_REQUEST, description: "broken" }).success,
    ).toBe(false);
  });

  // INV-47
  it("refuses a description longer than the database column allows", () => {
    expect(
      submitMaintenanceRequestSchema.safeParse({ ...VALID_REQUEST, description: "b".repeat(2001) })
        .success,
    ).toBe(false);
  });

  // INV-48
  it("refuses an urgency that is not one of the three", () => {
    expect(
      submitMaintenanceRequestSchema.safeParse({ ...VALID_REQUEST, urgency: "critical" }).success,
    ).toBe(false);
  });

  it("accepts each urgency a tenant can choose", () => {
    for (const urgency of ["low", "normal", "urgent"]) {
      expect(submitMaintenanceRequestSchema.safeParse({ ...VALID_REQUEST, urgency }).success).toBe(
        true,
      );
    }
  });
});

describe("updateMaintenanceRequestStatusSchema", () => {
  it("accepts a status the database knows", () => {
    expect(
      updateMaintenanceRequestStatusSchema.safeParse({
        requestId: REQUEST_ID,
        nextStatus: "resolved",
      }).success,
    ).toBe(true);
  });

  it("refuses a status that is not one of the four", () => {
    expect(
      updateMaintenanceRequestStatusSchema.safeParse({
        requestId: REQUEST_ID,
        nextStatus: "closed",
      }).success,
    ).toBe(false);
  });

  it("refuses a request identifier that is not one", () => {
    expect(
      updateMaintenanceRequestStatusSchema.safeParse({
        requestId: "the-tap-one",
        nextStatus: "resolved",
      }).success,
    ).toBe(false);
  });
});

describe("confirmMaintenanceResolutionSchema", () => {
  it("carries nothing but the request, because there is nothing for a tenant to decide", () => {
    const parsed = confirmMaintenanceResolutionSchema.parse({
      requestId: REQUEST_ID,
      status: "resolved",
    });

    expect(Object.keys(parsed)).toEqual(["requestId"]);
  });

  it("refuses a request identifier that is not one", () => {
    expect(confirmMaintenanceResolutionSchema.safeParse({ requestId: "the-tap-one" }).success).toBe(
      false,
    );
  });
});
