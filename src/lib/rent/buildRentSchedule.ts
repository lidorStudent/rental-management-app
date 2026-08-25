import { assertValidIsoDate, type IsoDate } from "@/lib/dates/isoDate";
import { deriveRentStatus, type RentStatus } from "@/lib/rent/deriveRentStatus";

/**
 * A lease's rent schedule, worked out from the lease itself.
 *
 * There is no rent periods table. A tenancy from March to September implies seven periods, and that
 * is a fact about its dates rather than something to store and keep in step. Deriving it is what
 * makes "status is never typed in" structurally true: there is nowhere to write one.
 *
 * A part month is charged in full. That simplification is recorded in the technical plan, and it is
 * the reason a period is identified by its month rather than by a span of days.
 */

export type RentPeriod = {
  /** The first day of the month this period covers, which is how a payment names it. */
  periodMonth: IsoDate;
  dueDate: IsoDate;
  amountDueInAgorot: number;
};

export type RentPeriodWithStatus = RentPeriod & {
  amountPaidInAgorot: number;
  outstandingInAgorot: number;
  status: RentStatus;
};

export type LeaseRentTerms = {
  startDate: IsoDate;
  endDate: IsoDate;
  rentAmountInAgorot: number;
  rentDueDay: number;
};

export function buildRentSchedule(lease: LeaseRentTerms): RentPeriod[] {
  refuseTermsThatCannotHaveASchedule(lease);

  const periods: RentPeriod[] = [];
  const lastYear = Number(lease.endDate.slice(0, 4));
  const lastMonth = Number(lease.endDate.slice(5, 7));
  const dueDay = String(lease.rentDueDay).padStart(2, "0");

  let year = Number(lease.startDate.slice(0, 4));
  let month = Number(lease.startDate.slice(5, 7));

  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    const monthText = String(month).padStart(2, "0");
    periods.push({
      periodMonth: `${year}-${monthText}-01`,
      dueDate: `${year}-${monthText}-${dueDay}`,
      amountDueInAgorot: lease.rentAmountInAgorot,
    });

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return periods;
}

/**
 * The schedule is only meaningful for terms the database would have accepted. Checking here means a
 * caller that assembled a lease by hand fails loudly rather than producing a plausible-looking
 * schedule from nonsense.
 */
function refuseTermsThatCannotHaveASchedule(lease: LeaseRentTerms): void {
  assertValidIsoDate(lease.startDate, "The lease start date");
  assertValidIsoDate(lease.endDate, "The lease end date");

  if (lease.endDate < lease.startDate) {
    throw new Error(
      `A lease must end after it starts, and ${lease.startDate} to ${lease.endDate} does not.`,
    );
  }
  if (!Number.isInteger(lease.rentDueDay) || lease.rentDueDay < 1 || lease.rentDueDay > 28) {
    throw new Error(`A rent due day is between 1 and 28, and this one is ${lease.rentDueDay}.`);
  }
  if (!Number.isInteger(lease.rentAmountInAgorot) || lease.rentAmountInAgorot <= 0) {
    throw new Error(`Rent must be a positive amount, and this one is ${lease.rentAmountInAgorot}.`);
  }
}

/**
 * The schedule with a status against each period, using what was actually paid for each month.
 *
 * The amounts come from an aggregate the database computed, one row per month, rather than from the
 * payments themselves. A three-year tenancy has thirty-six periods however many payments went into
 * them.
 */
export function buildRentScheduleWithStatus({
  lease,
  paidByPeriodMonth,
  currentDate,
}: {
  lease: LeaseRentTerms;
  paidByPeriodMonth: ReadonlyMap<string, number>;
  currentDate: IsoDate;
}): RentPeriodWithStatus[] {
  return buildRentSchedule(lease).map((period) => {
    const amountPaidInAgorot = paidByPeriodMonth.get(period.periodMonth) ?? 0;

    return {
      ...period,
      amountPaidInAgorot,
      outstandingInAgorot: period.amountDueInAgorot - amountPaidInAgorot,
      status: deriveRentStatus({
        amountDueInAgorot: period.amountDueInAgorot,
        amountPaidInAgorot,
        dueDate: period.dueDate,
        currentDate,
      }),
    };
  });
}
