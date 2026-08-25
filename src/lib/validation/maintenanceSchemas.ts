import { z } from "zod";

import { uuidField } from "@/lib/validation/fieldSchemas";
import type { Database } from "@/types/database";

const MAINTENANCE_URGENCIES = [
  "low",
  "normal",
  "urgent",
] as const satisfies readonly Database["public"]["Enums"]["maintenance_urgency"][];

const MAINTENANCE_STATUSES = [
  "submitted",
  "acknowledged",
  "in_progress",
  "resolved",
] as const satisfies readonly Database["public"]["Enums"]["maintenance_status"][];

/**
 * There is no lease in this schema on purpose. The tenant's lease is resolved from their session on
 * the server, so a tenant cannot report a problem against somebody else's flat by editing the form.
 *
 * The lower bound on the description is a rule, not a formality: "broken" gives a landlord nothing
 * to act on, and a request nobody can act on is the failure this product exists to remove.
 */
export const submitMaintenanceRequestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Give the problem a short title.")
    .max(120, "Use at most 120 characters."),
  description: z
    .string()
    .trim()
    .min(10, "Describe the problem in a sentence, so it can be acted on.")
    .max(2000, "Use at most 2000 characters."),
  urgency: z
    .enum(MAINTENANCE_URGENCIES, {
      errorMap: () => ({ message: "Choose how urgent this is." }),
    })
    .default("normal"),
});

export const updateMaintenanceRequestStatusSchema = z.object({
  requestId: uuidField,
  nextStatus: z.enum(MAINTENANCE_STATUSES, {
    errorMap: () => ({ message: "Choose a status." }),
  }),
});

export type SubmitMaintenanceRequestInput = z.input<typeof submitMaintenanceRequestSchema>;
export type UpdateMaintenanceRequestStatusInput = z.input<
  typeof updateMaintenanceRequestStatusSchema
>;
