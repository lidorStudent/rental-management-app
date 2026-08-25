import { assertValidIsoDate, type IsoDate } from "@/lib/dates/isoDate";

/**
 * Domain invariant 2: rent status is derived, never typed in.
 *
 * There is no status column anywhere in the database, so this function is the only definition of
 * what "overdue" means. Everything it needs is an argument, including the current date: a rule that
 * reads the clock can only be tested on the day it happens to be, and "is this period overdue?" is
 * a question worth asking about days other than today.
 */

export type RentStatus = "due" | "partial" | "paid" | "overdue";

export type RentPeriodFacts = {
  amountDueInAgorot: number;
  amountPaidInAgorot: number;
  /** The day the rent for this period falls due. */
  dueDate: IsoDate;
  /** What the server considers today. Supplied, never read from the clock in here. */
  currentDate: IsoDate;
};

/**
 * The four statuses in the order they are decided. The order is the rule, and it is the part worth
 * being able to recite:
 *
 *   1. paid, when the payments cover the rent. An overpayment is still paid.
 *   2. overdue, when the due date has passed and they do not.
 *   3. partial, when something has been paid and the due date has not passed yet.
 *   4. due, when nothing has been paid and the due date has not passed yet.
 *
 * A part-paid period whose due date has gone reads as overdue rather than partial, because the
 * landlord needs to see that it still needs chasing. How much is outstanding is a subtraction the
 * caller can do, and it is shown next to the status so the part payment is not hidden.
 */
export function deriveRentStatus({
  amountDueInAgorot,
  amountPaidInAgorot,
  dueDate,
  currentDate,
}: RentPeriodFacts): RentStatus {
  assertValidIsoDate(dueDate, "The due date");
  assertValidIsoDate(currentDate, "The current date");

  if (!Number.isInteger(amountDueInAgorot) || amountDueInAgorot <= 0) {
    throw new Error(
      `A rent period must charge a positive amount, and this one charges ${amountDueInAgorot}.`,
    );
  }
  if (!Number.isInteger(amountPaidInAgorot) || amountPaidInAgorot < 0) {
    throw new Error(
      `Payments cannot total a negative amount, and these total ${amountPaidInAgorot}.`,
    );
  }

  if (amountPaidInAgorot >= amountDueInAgorot) {
    return "paid";
  }
  if (currentDate > dueDate) {
    return "overdue";
  }
  if (amountPaidInAgorot > 0) {
    return "partial";
  }
  return "due";
}
