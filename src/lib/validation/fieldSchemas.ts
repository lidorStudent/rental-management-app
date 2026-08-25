import { z } from "zod";

import { isValidIsoDate } from "@/lib/dates/isoDate";
import { parseCurrencyInputToCents } from "@/lib/money/parseCurrencyInputToCents";

/**
 * The field types that carry logic, shared by every entity schema so that there is one definition of
 * what an email address or an amount of money is.
 *
 * Plain length limits are deliberately not here. A property name being between two and a hundred and
 * twenty characters is a fact about property names, and it reads better written out where it applies
 * than hidden behind a helper.
 */

/**
 * Normalised, not merely validated: trimmed and lowercased, because "Maya.Levi@Example.co.il " and
 * "maya.levi@example.co.il" are the same person, and Supabase Auth stores the lowercase form. Two
 * spellings of one address would mean a landlord could create a second account for a tenant who
 * already has one.
 */
export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter an email address.")
  .max(320, "That email address is too long.")
  .email("Enter a valid email address.");

export const personNameField = z
  .string()
  .trim()
  .min(2, "Enter a full name.")
  .max(120, "Use at most 120 characters.");

export const uuidField = z.string().uuid("That record could not be identified.");

/** A calendar date the user picked, checked against the calendar rather than only against a pattern. */
export const isoDateField = z.string().trim().refine(isValidIsoDate, "Enter a date as YYYY-MM-DD.");

/**
 * An amount of money typed by a person, returned as whole agorot. Zero and negative amounts are
 * refused here rather than downstream: there is no such thing as a rent of nothing or a payment of
 * minus two hundred shekels.
 */
export const positiveMoneyField = buildMoneyField({ allowZero: false });

/** The same, for amounts where nothing is a legitimate answer, such as a deposit that was not taken. */
export const nonNegativeMoneyField = buildMoneyField({ allowZero: true });

function buildMoneyField({ allowZero }: { allowZero: boolean }) {
  return z.string().trim().transform(toAgorot(allowZero));
}

function toAgorot(allowZero: boolean) {
  return (input: string, context: z.RefinementCtx): number => {
    const amountInAgorot = parseCurrencyInputToCents(input);

    if (amountInAgorot === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter an amount such as 6500 or 6500.50.",
      });
      return z.NEVER;
    }
    if (amountInAgorot < 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter an amount above zero." });
      return z.NEVER;
    }
    if (amountInAgorot === 0 && !allowZero) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter an amount above zero." });
      return z.NEVER;
    }
    // A hundred million shekels is not a rent; it is a typo with too many zeros.
    if (amountInAgorot > 10_000_000_00) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "That amount is too large." });
      return z.NEVER;
    }

    return amountInAgorot;
  };
}

/** A whole number typed into a form, such as a bedroom count or a day of the month. */
export function wholeNumberField({
  minimum,
  maximum,
  outOfRangeMessage,
}: {
  minimum: number;
  maximum: number;
  outOfRangeMessage: string;
}) {
  return z.coerce
    .number({ invalid_type_error: "Enter a whole number." })
    .int("Enter a whole number.")
    .min(minimum, outOfRangeMessage)
    .max(maximum, outOfRangeMessage);
}

/**
 * Optional free text where an empty box and an absent value mean the same thing. Without this, a
 * cleared field would be stored as an empty string, which is a second way of saying "nothing".
 */
export function optionalTextField({
  maximum,
  tooLongMessage,
}: {
  maximum: number;
  tooLongMessage: string;
}) {
  return z
    .string()
    .trim()
    .max(maximum, tooLongMessage)
    .optional()
    .transform((value) => (value === undefined || value === "" ? undefined : value));
}
