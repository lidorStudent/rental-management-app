import { describe, expect, it } from "vitest";

import { createLeaseSchema, endLeaseSchema, renewLeaseSchema } from "@/lib/validation/leaseSchemas";

const UNIT_ID = "3f6d8f7a-1b2c-4d3e-8f90-1a2b3c4d5e6f";
const VALID_LEASE = {
  unitId: UNIT_ID,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  rentAmount: "6500",
  depositAmount: "13000",
  rentDueDay: 10,
};

describe("createLeaseSchema", () => {
  it("accepts a tenancy", () => {
    expect(createLeaseSchema.safeParse(VALID_LEASE).success).toBe(true);
  });

  // CORE-10: what the landlord types becomes whole agorot.
  it("turns the rent a landlord types into whole agorot", () => {
    const parsed = createLeaseSchema.parse({ ...VALID_LEASE, rentAmount: "6,500.50" });

    expect(parsed.rentAmount).toBe(650050);
    expect(parsed.depositAmount).toBe(1300000);
  });

  // INV-29: no deposit is a real answer.
  it("reads an empty deposit as none taken", () => {
    expect(createLeaseSchema.parse({ ...VALID_LEASE, depositAmount: "" }).depositAmount).toBe(0);
    expect(
      createLeaseSchema.parse({ ...VALID_LEASE, depositAmount: undefined }).depositAmount,
    ).toBe(0);
  });

  // INV-22
  it("refuses a start date the calendar does not have", () => {
    expect(createLeaseSchema.safeParse({ ...VALID_LEASE, startDate: "2026-02-30" }).success).toBe(
      false,
    );
  });

  // INV-23
  it("refuses a tenancy that ends before it starts", () => {
    expect(createLeaseSchema.safeParse({ ...VALID_LEASE, endDate: "2025-12-31" }).success).toBe(
      false,
    );
  });

  // INV-24
  it("refuses a tenancy that starts and ends on the same day", () => {
    expect(
      createLeaseSchema.safeParse({ ...VALID_LEASE, endDate: VALID_LEASE.startDate }).success,
    ).toBe(false);
  });

  it("puts the message about the dates on the end date, where the landlord will look", () => {
    const result = createLeaseSchema.safeParse({ ...VALID_LEASE, endDate: "2025-12-31" });
    const paths = result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));

    expect(paths).toContain("endDate");
  });

  // INV-25
  it("refuses a rent of nothing", () => {
    expect(createLeaseSchema.safeParse({ ...VALID_LEASE, rentAmount: "0" }).success).toBe(false);
  });

  // INV-26
  it("refuses a negative rent", () => {
    expect(createLeaseSchema.safeParse({ ...VALID_LEASE, rentAmount: "-500" }).success).toBe(false);
  });

  // INV-27
  it("refuses more precision than money has", () => {
    expect(createLeaseSchema.safeParse({ ...VALID_LEASE, rentAmount: "1.005" }).success).toBe(
      false,
    );
  });

  // INV-28
  it("refuses a rent that is not a number", () => {
    expect(createLeaseSchema.safeParse({ ...VALID_LEASE, rentAmount: "abc" }).success).toBe(false);
  });

  it("refuses an absurd rent, which is a typo with too many zeros", () => {
    expect(createLeaseSchema.safeParse({ ...VALID_LEASE, rentAmount: "999999999" }).success).toBe(
      false,
    );
  });

  // INV-30
  it("refuses a negative deposit", () => {
    expect(createLeaseSchema.safeParse({ ...VALID_LEASE, depositAmount: "-1" }).success).toBe(
      false,
    );
  });

  // INV-31, INV-32: every month has a 28th, and none has a 31st.
  it("refuses a due day some months do not have", () => {
    expect(createLeaseSchema.safeParse({ ...VALID_LEASE, rentDueDay: 29 }).success).toBe(false);
    expect(createLeaseSchema.safeParse({ ...VALID_LEASE, rentDueDay: 31 }).success).toBe(false);
  });

  it("refuses a due day below the first of the month", () => {
    expect(createLeaseSchema.safeParse({ ...VALID_LEASE, rentDueDay: 0 }).success).toBe(false);
  });

  it("accepts the last due day every month has", () => {
    expect(createLeaseSchema.safeParse({ ...VALID_LEASE, rentDueDay: 28 }).success).toBe(true);
  });

  it("refuses a unit that is not an identifier at all", () => {
    expect(
      createLeaseSchema.safeParse({ ...VALID_LEASE, unitId: "the-flat-upstairs" }).success,
    ).toBe(false);
  });
});

describe("endLeaseSchema", () => {
  // CORE-15, PROC-03
  it("accepts a new end date for a named tenancy", () => {
    expect(endLeaseSchema.safeParse({ leaseId: UNIT_ID, endDate: "2026-06-30" }).success).toBe(
      true,
    );
  });

  it("refuses an end date the calendar does not have", () => {
    expect(endLeaseSchema.safeParse({ leaseId: UNIT_ID, endDate: "2026-06-31" }).success).toBe(
      false,
    );
  });

  // CORE-15
  it("carries nothing but the tenancy and the date, because nothing else may change", () => {
    const parsed = endLeaseSchema.parse({
      leaseId: UNIT_ID,
      endDate: "2026-06-30",
      rentAmount: "1",
    });

    expect(Object.keys(parsed).sort()).toEqual(["endDate", "leaseId"]);
  });
});

describe("renewLeaseSchema", () => {
  it("accepts the next tenancy's terms", () => {
    expect(
      renewLeaseSchema.safeParse({
        leaseId: UNIT_ID,
        startDate: "2027-01-01",
        endDate: "2027-12-31",
        rentAmount: "6800",
        rentDueDay: 10,
      }).success,
    ).toBe(true);
  });

  // CORE-16
  it("refuses a renewal that ends before it starts", () => {
    expect(
      renewLeaseSchema.safeParse({
        leaseId: UNIT_ID,
        startDate: "2027-12-31",
        endDate: "2027-01-01",
        rentAmount: "6800",
        rentDueDay: 10,
      }).success,
    ).toBe(false);
  });

  // CORE-16, PROC-04
  it("carries no unit and no tenant, because both come from the tenancy being renewed", () => {
    const parsed = renewLeaseSchema.parse({
      leaseId: UNIT_ID,
      startDate: "2027-01-01",
      endDate: "2027-12-31",
      rentAmount: "6800",
      rentDueDay: 10,
      unitId: "somebody-elses-unit",
    });

    expect(parsed).not.toHaveProperty("unitId");
  });
});
