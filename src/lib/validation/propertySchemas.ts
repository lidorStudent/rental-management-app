import { z } from "zod";

import { optionalTextField, uuidField } from "@/lib/validation/fieldSchemas";

/**
 * The limits here are the same numbers as the check constraints on public.properties. The database
 * is the one that cannot be bypassed; these exist so that the person filling the form is told which
 * field is wrong, instead of being handed a constraint violation.
 */
export const createPropertySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the building a name you will recognise.")
    .max(120, "Use at most 120 characters."),
  addressLine: z
    .string()
    .trim()
    .min(3, "Enter the street and number.")
    .max(200, "Use at most 200 characters."),
  city: z.string().trim().min(2, "Enter the city.").max(100, "Use at most 100 characters."),
  postalCode: optionalTextField({ maximum: 20, tooLongMessage: "That postal code is too long." }),
});

export const updatePropertySchema = createPropertySchema.extend({
  propertyId: uuidField,
});

export type CreatePropertyInput = z.input<typeof createPropertySchema>;
export type UpdatePropertyInput = z.input<typeof updatePropertySchema>;

export const deletePropertySchema = z.object({ propertyId: uuidField });

export type DeletePropertyInput = z.input<typeof deletePropertySchema>;
