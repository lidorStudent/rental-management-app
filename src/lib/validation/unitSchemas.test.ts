import { describe, expect, it } from "vitest";

import { createUnitSchema, updateUnitSchema } from "@/lib/validation/unitSchemas";

const PROPERTY_ID = "3f6d8f7a-1b2c-4d3e-8f90-1a2b3c4d5e6f";
const VALID_UNIT = { propertyId: PROPERTY_ID, label: "Flat 2", bedroomCount: 3 };

describe("createUnitSchema", () => {
  it("accepts a unit", () => {
    expect(createUnitSchema.safeParse(VALID_UNIT).success).toBe(true);
  });

  it("accepts a label of one character, because landlords label units how they like", () => {
    expect(createUnitSchema.safeParse({ ...VALID_UNIT, label: "A" }).success).toBe(true);
  });

  // INV-21: not recorded is not the same as none.
  it("accepts a unit whose bedroom count was not recorded", () => {
    expect(createUnitSchema.safeParse({ ...VALID_UNIT, bedroomCount: undefined }).success).toBe(
      true,
    );
  });

  it("accepts a studio with no bedrooms", () => {
    expect(createUnitSchema.safeParse({ ...VALID_UNIT, bedroomCount: 0 }).success).toBe(true);
  });

  it("refuses an empty label", () => {
    expect(createUnitSchema.safeParse({ ...VALID_UNIT, label: "" }).success).toBe(false);
  });

  it("refuses a label longer than the database column allows", () => {
    expect(createUnitSchema.safeParse({ ...VALID_UNIT, label: "F".repeat(41) }).success).toBe(
      false,
    );
  });

  // INV-19
  it("refuses a negative number of bedrooms", () => {
    expect(createUnitSchema.safeParse({ ...VALID_UNIT, bedroomCount: -1 }).success).toBe(false);
  });

  // INV-20
  it("refuses more bedrooms than a let unit plausibly has", () => {
    expect(createUnitSchema.safeParse({ ...VALID_UNIT, bedroomCount: 21 }).success).toBe(false);
  });

  it("refuses a fraction of a bedroom", () => {
    expect(createUnitSchema.safeParse({ ...VALID_UNIT, bedroomCount: 2.5 }).success).toBe(false);
  });

  it("refuses a unit that names no property", () => {
    expect(createUnitSchema.safeParse({ label: "Flat 2" }).success).toBe(false);
  });
});

describe("updateUnitSchema", () => {
  it("accepts an edit that names the unit", () => {
    expect(updateUnitSchema.safeParse({ unitId: PROPERTY_ID, label: "Flat 3" }).success).toBe(true);
  });

  it("does not let an edit move a unit to another building", () => {
    const parsed = updateUnitSchema.parse({
      unitId: PROPERTY_ID,
      label: "Flat 3",
      propertyId: PROPERTY_ID,
    });

    expect(parsed).not.toHaveProperty("propertyId");
  });
});
