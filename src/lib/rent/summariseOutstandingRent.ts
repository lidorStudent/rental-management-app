import { type IsoDate } from "@/lib/dates/isoDate";
import { buildRentSchedule, type LeaseRentTerms } from "@/lib/rent/buildRentSchedule";
import { deriveRentStatus } from "@/lib/rent/deriveRentStatus";

/**
 * What one tenancy owes, from its terms and a single total.
 *
 * The overview across a whole portfolio has one aggregate row per tenancy and no payment rows at
 * all, so the only figure available is the sum of everything received. Applying it oldest period
 * first is the convention a ledger follows anyway: money that arrives pays off the oldest arrears.
 *
 * The work here is proportional to the number of months a tenancy runs, never to the number of
 * payments in it.
 */

export type LeaseRentSummary = {
  periodsPayableCount: number;
  chargedToDateInAgorot: number;
  paidInAgorot: number;
  /** Positive when the tenant owes, negative when they are in credit. */
  outstandingInAgorot: number;
  overduePeriodCount: number;
  earliestOverdueDueDate: IsoDate | null;
};

export function summariseLeaseRentFromTotal({
  lease,
  totalPaidInAgorot,
  currentDate,
}: {
  lease: LeaseRentTerms;
  totalPaidInAgorot: number;
  currentDate: IsoDate;
}): LeaseRentSummary {
  if (!Number.isInteger(totalPaidInAgorot) || totalPaidInAgorot < 0) {
    throw new Error(
      `Payments cannot total a negative amount, and these total ${totalPaidInAgorot}.`,
    );
  }

  const schedule = buildRentSchedule(lease);
  let remaining = totalPaidInAgorot;
  let periodsPayableCount = 0;
  let chargedToDateInAgorot = 0;
  let overduePeriodCount = 0;
  let earliestOverdueDueDate: IsoDate | null = null;

  for (const period of schedule) {
    const paidForPeriod = Math.min(remaining, period.amountDueInAgorot);
    remaining -= paidForPeriod;

    if (period.dueDate > currentDate) {
      continue;
    }

    periodsPayableCount += 1;
    chargedToDateInAgorot += period.amountDueInAgorot;

    const status = deriveRentStatus({
      amountDueInAgorot: period.amountDueInAgorot,
      amountPaidInAgorot: paidForPeriod,
      dueDate: period.dueDate,
      currentDate,
    });

    if (status === "overdue") {
      overduePeriodCount += 1;
      earliestOverdueDueDate = earliestOverdueDueDate ?? period.dueDate;
    }
  }

  return {
    periodsPayableCount,
    chargedToDateInAgorot,
    paidInAgorot: totalPaidInAgorot,
    outstandingInAgorot: chargedToDateInAgorot - totalPaidInAgorot,
    overduePeriodCount,
    earliestOverdueDueDate,
  };
}

/**
 * What a landlord is owed across a portfolio.
 *
 * Arrears are added up, and credit on one tenancy is not netted against arrears on another: a tenant
 * who paid next month early does not reduce what a different tenant owes, and a total that pretended
 * otherwise would be the wrong number to act on.
 */
export function totalArrearsInAgorot(summaries: readonly LeaseRentSummary[]): number {
  return summaries.reduce((total, summary) => total + Math.max(0, summary.outstandingInAgorot), 0);
}
