import { z } from "zod";

import {
  isoDateField,
  nonNegativeMoneyField,
  positiveMoneyField,
  uuidField,
  wholeNumberField,
} from "@/lib/validation/fieldSchemas";

/**
 * Empty means no deposit was taken, which is a real answer and not a missing one.
 */
const depositField = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === undefined || value === "" ? "0" : value))
  .pipe(nonNegativeMoneyField);

const leaseTermsShape = {
  startDate: isoDateField,
  endDate: isoDateField,
  rentAmount: positiveMoneyField,
  depositAmount: depositField,
  // Every month has a 28th. Capping the due day removes the question of what a lease due on the
  // 31st does in February, rather than answering it in four different places later.
  rentDueDay: wholeNumberField({
    minimum: 1,
    maximum: 28,
    outOfRangeMessage: "Choose a day between 1 and 28, so that every month has one.",
  }),
};

/**
 * The end date must be strictly after the start date, matching the leases_end_after_start check
 * constraint. A lease that starts and ends on the same day is a viewing, not a tenancy.
 *
 * Whether these dates collide with another lease on the same unit is not checked here. That needs
 * the other leases, so it belongs to findConflictingLease and, finally, to the exclusion constraint.
 */
const endsAfterItStarts = (values: { startDate: string; endDate: string }) =>
  values.endDate > values.startDate;

const endsAfterItStartsMessage = {
  message: "The end date must be after the start date.",
  path: ["endDate"],
};

export const createLeaseSchema = z
  .object({ unitId: uuidField, ...leaseTermsShape })
  .refine(endsAfterItStarts, endsAfterItStartsMessage);

export const updateLeaseSchema = z
  .object({ leaseId: uuidField, ...leaseTermsShape })
  .refine(endsAfterItStarts, endsAfterItStartsMessage);

export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
export type UpdateLeaseInput = z.infer<typeof updateLeaseSchema>;
