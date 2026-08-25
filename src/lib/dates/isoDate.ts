/**
 * Calendar dates are handled as `YYYY-MM-DD` strings throughout the business rules, never as Date
 * objects.
 *
 * The reason is that a rent due date is a calendar fact, not an instant: the tenth of March is the
 * tenth of March whether the reader is in Tel Aviv or in London. A Date carries a time and a zone
 * with it, and every bug in this class of code comes from one of those two travelling silently.
 *
 * The format also sorts correctly as text, so `"2026-05-31" < "2026-06-01"` is both true and
 * chronologically meaningful. That is what lets the rules below compare dates with `<` and `<=`
 * without parsing anything.
 */

/** A calendar date in `YYYY-MM-DD` form. An alias for readability, not an enforced type. */
export type IsoDate = string;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when the value is a real date on the calendar. The pattern alone would accept 2026-02-30, so
 * the parts are rebuilt and compared back.
 *
 * Constructing a Date here is not reading the clock: it is asking the calendar whether a given day
 * exists, with every field supplied.
 */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const rebuilt = new Date(Date.UTC(year, month - 1, day));

  return (
    rebuilt.getUTCFullYear() === year &&
    rebuilt.getUTCMonth() === month - 1 &&
    rebuilt.getUTCDate() === day
  );
}

/** True when the value is a real date that falls on the first day of its month. */
export function isFirstDayOfMonth(value: string): boolean {
  return isValidIsoDate(value) && value.endsWith("-01");
}

/**
 * Throws when a date that the caller promised was validated is not. Used by the rules below so that
 * a programming mistake fails loudly here instead of producing a quietly wrong comparison later.
 */
export function assertValidIsoDate(value: string, fieldName: string): void {
  if (!isValidIsoDate(value)) {
    throw new Error(`${fieldName} must be a calendar date in YYYY-MM-DD form, and was "${value}".`);
  }
}

/**
 * The calendar day after this one.
 *
 * Used to tell a landlord the earliest date a new tenancy on a unit could start, given that the
 * outgoing tenancy owns its own end date. Date arithmetic is the one thing text cannot do, so this
 * is the single place a Date object is built, and it is built in UTC with every field supplied.
 */
export function nextDay(value: IsoDate): IsoDate {
  assertValidIsoDate(value, "The date");

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const theNextDay = new Date(Date.UTC(year, month - 1, day + 1));

  return theNextDay.toISOString().slice(0, 10);
}
