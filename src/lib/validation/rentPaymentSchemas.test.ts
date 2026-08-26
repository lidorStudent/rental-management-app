import { describe, expect, it } from "vitest";

import {
  buildRecordRentPaymentSchema,
  buildUpdateRentPaymentSchema,
} from "@/lib/validation/rentPaymentSchemas";

const TODAY = "2026-08-25";
const LEASE_ID = "3f6d8f7a-1b2c-4d3e-8f90-1a2b3c4d5e6f";
const schema = buildRecordRentPaymentSchema(TODAY);

const VALID_PAYMENT = {
  leaseId: LEASE_ID,
  periodMonth: "2026-08-01",
  amount: "6500",
  receivedOn: "2026-08-20",
  method: "bank_transfer",
  reference: "Standing order 4471",
};

describe("buildRecordRentPaymentSchema", () => {
  it("accepts a payment that has arrived", () => {
    expect(schema.safeParse(VALID_PAYMENT).success).toBe(true);
  });

  it("turns the amount into whole agorot", () => {
    expect(schema.parse({ ...VALID_PAYMENT, amount: "3,250.75" }).amount).toBe(325075);
  });

  it("accepts a payment with no reference", () => {
    expect(schema.parse({ ...VALID_PAYMENT, reference: "" }).reference).toBeUndefined();
  });

  // INV-36, INV-37
  it("refuses a payment of nothing", () => {
    expect(schema.safeParse({ ...VALID_PAYMENT, amount: "0" }).success).toBe(false);
  });

  it("refuses a negative payment, which would be a refund", () => {
    expect(schema.safeParse({ ...VALID_PAYMENT, amount: "-100" }).success).toBe(false);
  });

  // INV-41: a period is named by the first of its month.
  it("refuses a period month that is not the first of a month", () => {
    expect(schema.safeParse({ ...VALID_PAYMENT, periodMonth: "2026-08-15" }).success).toBe(false);
  });

  // INV-39
  it("refuses a received date the calendar does not have", () => {
    expect(schema.safeParse({ ...VALID_PAYMENT, receivedOn: "2026-13-01" }).success).toBe(false);
  });

  /**
   * INV-38. The rule needs to know what today is, which is why the schema is built rather than
   * exported: nothing in these rules reads the clock.
   */
  it("accepts a payment received today", () => {
    expect(schema.safeParse({ ...VALID_PAYMENT, receivedOn: TODAY }).success).toBe(true);
  });

  it("refuses a payment recorded as arriving tomorrow", () => {
    expect(schema.safeParse({ ...VALID_PAYMENT, receivedOn: "2026-08-26" }).success).toBe(false);
  });

  it("judges the future against the date it was built with, not the machine's clock", () => {
    const schemaFromLastYear = buildRecordRentPaymentSchema("2025-01-01");

    expect(
      schemaFromLastYear.safeParse({ ...VALID_PAYMENT, receivedOn: "2025-06-01" }).success,
    ).toBe(false);
  });

  it("refuses to be built with a date that is not a date", () => {
    expect(() => buildRecordRentPaymentSchema("today")).toThrow(/calendar date/);
  });

  // INV-42
  it("refuses a way of paying that this product does not record", () => {
    expect(schema.safeParse({ ...VALID_PAYMENT, method: "crypto" }).success).toBe(false);
  });

  it("accepts each way money actually arrives", () => {
    for (const method of ["bank_transfer", "cash", "cheque", "card", "other"]) {
      expect(schema.safeParse({ ...VALID_PAYMENT, method }).success).toBe(true);
    }
  });

  // INV-43
  it("refuses a reference longer than the database column allows", () => {
    expect(schema.safeParse({ ...VALID_PAYMENT, reference: "R".repeat(101) }).success).toBe(false);
  });
});

describe("buildUpdateRentPaymentSchema", () => {
  const correctionSchema = buildUpdateRentPaymentSchema(TODAY);
  const VALID_CORRECTION = {
    paymentId: LEASE_ID,
    periodMonth: "2026-07-01",
    amount: "6500",
    receivedOn: "2026-07-20",
    method: "cash",
    reference: null,
  };

  it("accepts a correction", () => {
    expect(correctionSchema.safeParse(VALID_CORRECTION).success).toBe(true);
  });

  /**
   * A correction cannot move a payment onto another tenancy, so the lease is not a field it has.
   */
  it("carries no lease, so a payment can never be moved onto another tenancy", () => {
    const parsed = correctionSchema.parse({ ...VALID_CORRECTION, leaseId: "another-tenancy" });

    expect(parsed).not.toHaveProperty("leaseId");
  });

  it("applies the same rules as recording one", () => {
    expect(correctionSchema.safeParse({ ...VALID_CORRECTION, amount: "0" }).success).toBe(false);
    expect(
      correctionSchema.safeParse({ ...VALID_CORRECTION, receivedOn: "2026-08-26" }).success,
    ).toBe(false);
  });
});
