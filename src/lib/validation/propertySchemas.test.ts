import { describe, expect, it } from "vitest";

import { createPropertySchema, updatePropertySchema } from "@/lib/validation/propertySchemas";

const VALID_PROPERTY = {
  name: "Rothschild 12",
  addressLine: "Rothschild Boulevard 12",
  city: "Tel Aviv-Yafo",
  postalCode: "6688212",
};

describe("createPropertySchema", () => {
  it("accepts a building", () => {
    expect(createPropertySchema.safeParse(VALID_PROPERTY).success).toBe(true);
  });

  it("accepts a building with no postal code, since formats differ by country", () => {
    expect(
      createPropertySchema.safeParse({ ...VALID_PROPERTY, postalCode: undefined }).success,
    ).toBe(true);
  });

  // INV-16: an empty box and an absent value must mean one thing.
  it("reads an empty postal code as nothing recorded", () => {
    expect(
      createPropertySchema.parse({ ...VALID_PROPERTY, postalCode: "" }).postalCode,
    ).toBeUndefined();
  });

  it("trims what was typed", () => {
    expect(createPropertySchema.parse({ ...VALID_PROPERTY, name: "  Rothschild 12  " }).name).toBe(
      "Rothschild 12",
    );
  });

  it("refuses a name that is only spaces", () => {
    expect(createPropertySchema.safeParse({ ...VALID_PROPERTY, name: "   " }).success).toBe(false);
  });

  // INV-12
  it("refuses a name longer than the database column allows", () => {
    expect(
      createPropertySchema.safeParse({ ...VALID_PROPERTY, name: "R".repeat(121) }).success,
    ).toBe(false);
  });

  // INV-13
  it("refuses a street line too short to find the building by", () => {
    expect(createPropertySchema.safeParse({ ...VALID_PROPERTY, addressLine: "ab" }).success).toBe(
      false,
    );
  });

  it("refuses a street line longer than the database column allows", () => {
    expect(
      createPropertySchema.safeParse({ ...VALID_PROPERTY, addressLine: "R".repeat(201) }).success,
    ).toBe(false);
  });

  // INV-14
  it("refuses a city of one character", () => {
    expect(createPropertySchema.safeParse({ ...VALID_PROPERTY, city: "a" }).success).toBe(false);
  });

  // INV-15
  it("refuses a postal code longer than the database column allows", () => {
    expect(
      createPropertySchema.safeParse({ ...VALID_PROPERTY, postalCode: "6".repeat(21) }).success,
    ).toBe(false);
  });
});

describe("updatePropertySchema", () => {
  it("accepts an edit that names the property", () => {
    expect(
      updatePropertySchema.safeParse({
        ...VALID_PROPERTY,
        propertyId: "3f6d8f7a-1b2c-4d3e-8f90-1a2b3c4d5e6f",
      }).success,
    ).toBe(true);
  });

  it("refuses an edit that names no property", () => {
    expect(updatePropertySchema.safeParse(VALID_PROPERTY).success).toBe(false);
  });

  it("refuses a property identifier that is not one", () => {
    expect(
      updatePropertySchema.safeParse({ ...VALID_PROPERTY, propertyId: "the-first-one" }).success,
    ).toBe(false);
  });
});
