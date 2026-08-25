import { z } from "zod";

import { uuidField, wholeNumberField } from "@/lib/validation/fieldSchemas";

/**
 * A unit's label is what the landlord recognises it by, so it may be as short as "A". The uniqueness
 * of a label within one property is a database constraint, not a rule this schema can see: it
 * depends on the other rows.
 */
export const createUnitSchema = z.object({
  propertyId: uuidField,
  label: z
    .string()
    .trim()
    .min(1, "Give the unit a label, such as Flat 2.")
    .max(40, "Use at most 40 characters."),
  bedroomCount: wholeNumberField({
    minimum: 0,
    maximum: 20,
    outOfRangeMessage: "Enter a number of bedrooms between 0 and 20.",
  })
    .optional()
    .nullable(),
});

export const updateUnitSchema = createUnitSchema.omit({ propertyId: true }).extend({
  unitId: uuidField,
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
