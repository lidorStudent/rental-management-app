import { assertValidIsoDate, type IsoDate } from "@/lib/dates/isoDate";

/**
 * Whether a rent period belongs to a lease at all.
 *
 * A payment settles a period, and a period is identified by the first day of its month. A lease
 * running from 15 March to 20 September implies periods for March through September inclusive, part
 * months included: the rent for a part month is charged in full, which is the simplification
 * recorded in the technical plan.
 *
 * So the test is on months, not on days. Comparing the day of the month would refuse a payment for
 * March against a lease that started on the fifteenth of March, which is exactly the period the
 * first payment settles.
 */
export function isPeriodMonthWithinLease({
  periodMonth,
  leaseStartDate,
  leaseEndDate,
}: {
  periodMonth: IsoDate;
  leaseStartDate: IsoDate;
  leaseEndDate: IsoDate;
}): boolean {
  assertValidIsoDate(periodMonth, "The period month");
  assertValidIsoDate(leaseStartDate, "The lease start date");
  assertValidIsoDate(leaseEndDate, "The lease end date");

  return (
    periodMonth >= firstDayOfTheMonthOf(leaseStartDate) &&
    periodMonth <= firstDayOfTheMonthOf(leaseEndDate)
  );
}

/** Text again: the first seven characters of an ISO date are its month. */
export function firstDayOfTheMonthOf(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}
