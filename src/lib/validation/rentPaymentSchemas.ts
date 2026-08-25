import { z } from "zod";

import { isFirstDayOfMonth, assertValidIsoDate, type IsoDate } from "@/lib/dates/isoDate";
import {
  isoDateField,
  optionalTextField,
  positiveMoneyField,
  uuidField,
} from "@/lib/validation/fieldSchemas";
import type { Database } from "@/types/database";

/**
 * Kept in step with the payment_method enum in the database: the satisfies clause below fails to
 * compile if a value here is not one Postgres would accept.
 */
const PAYMENT_METHODS = [
  "bank_transfer",
  "cash",
  "cheque",
  "card",
  "other",
] as const satisfies readonly Database["public"]["Enums"]["payment_method"][];

/**
 * The schema is built rather than exported directly, because one of its rules needs to know what
 * today is: a payment cannot be recorded as received in the future. Nothing in these rules reads the
 * clock itself, so the caller supplies the date and the rule stays a pure function of its inputs.
 */
export function buildRecordRentPaymentSchema(currentDate: IsoDate) {
  assertValidIsoDate(currentDate, "currentDate");

  return z.object({
    leaseId: uuidField,
    // A payment settles a rent period, and a period is identified by the first day of its month.
    // Whether that month falls inside the lease is checked by the action, which has the lease.
    periodMonth: isoDateField.refine(isFirstDayOfMonth, "Choose the month this payment settles."),
    amount: positiveMoneyField,
    receivedOn: isoDateField.refine(
      (date) => date <= currentDate,
      "Record money that has arrived, not money you expect.",
    ),
    method: z.enum(PAYMENT_METHODS, {
      errorMap: () => ({ message: "Choose how the money arrived." }),
    }),
    reference: optionalTextField({
      maximum: 100,
      tooLongMessage: "Use at most 100 characters.",
    }),
  });
}

export function buildUpdateRentPaymentSchema(currentDate: IsoDate) {
  return buildRecordRentPaymentSchema(currentDate)
    .omit({ leaseId: true })
    .extend({ paymentId: uuidField });
}

export type RecordRentPaymentInput = z.input<ReturnType<typeof buildRecordRentPaymentSchema>>;
export type UpdateRentPaymentInput = z.input<ReturnType<typeof buildUpdateRentPaymentSchema>>;
