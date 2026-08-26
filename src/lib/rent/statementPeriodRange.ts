import { assertValidIsoDate, isValidIsoDate, type IsoDate } from "@/lib/dates/isoDate";
import { firstDayOfTheMonthOf } from "@/lib/rent/isPeriodMonthWithinLease";

/**
 * Which months a statement covers.
 *
 * The two values arrive from the URL as `YYYY-MM`, so they can be anything at all. Rather than
 * refusing a statement because someone edited the address bar, the range falls back to the sensible
 * one: the whole tenancy up to today.
 *
 * Both ends are clamped inside the tenancy, because a statement for months a tenancy did not run
 * would list nothing and look like a fault.
 */
export type StatementRange = { fromMonth: IsoDate; toMonth: IsoDate };

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export function chooseStatementRange({
  requestedFrom,
  requestedTo,
  leaseStartDate,
  leaseEndDate,
  currentDate,
}: {
  requestedFrom: string | undefined;
  requestedTo: string | undefined;
  leaseStartDate: IsoDate;
  leaseEndDate: IsoDate;
  currentDate: IsoDate;
}): StatementRange {
  assertValidIsoDate(leaseStartDate, "The lease start date");
  assertValidIsoDate(leaseEndDate, "The lease end date");
  assertValidIsoDate(currentDate, "The current date");

  const firstMonthOfLease = firstDayOfTheMonthOf(leaseStartDate);
  const lastMonthOfLease = firstDayOfTheMonthOf(leaseEndDate);
  const thisMonth = firstDayOfTheMonthOf(currentDate);

  // Up to today, or the end of the tenancy if it finished first: a statement of months that have
  // not happened yet is a forecast, and this is a record.
  const defaultTo = thisMonth < lastMonthOfLease ? thisMonth : lastMonthOfLease;

  const fromMonth = clamp(
    monthOrNull(requestedFrom) ?? firstMonthOfLease,
    firstMonthOfLease,
    lastMonthOfLease,
  );
  const toMonth = clamp(monthOrNull(requestedTo) ?? defaultTo, firstMonthOfLease, lastMonthOfLease);

  // A range that reads backwards is a typo, not a request for nothing.
  return toMonth < fromMonth ? { fromMonth: toMonth, toMonth: fromMonth } : { fromMonth, toMonth };
}

/** `YYYY-MM` as the first day of that month, or null when it is not a month at all. */
export function monthOrNull(value: string | undefined): IsoDate | null {
  if (value === undefined || !MONTH_PATTERN.test(value)) {
    return null;
  }

  const firstOfMonth = `${value}-01`;
  return isValidIsoDate(firstOfMonth) ? firstOfMonth : null;
}

/** The `YYYY-MM` form a month input expects. */
export function monthInputValue(periodMonth: IsoDate): string {
  return periodMonth.slice(0, 7);
}

function clamp(value: IsoDate, lowest: IsoDate, highest: IsoDate): IsoDate {
  if (value < lowest) {
    return lowest;
  }
  return value > highest ? highest : value;
}
