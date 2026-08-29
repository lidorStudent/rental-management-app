import type { LeaseLifecycle } from "@/lib/leases/describeLeaseLifecycle";
import type { RentStatus } from "@/lib/rent/deriveRentStatus";
import type { LeaseRentSummary } from "@/lib/rent/summariseOutstandingRent";

/**
 * What the rent overview shows in its status column for one whole tenancy.
 *
 * A tenancy that has never been charged has no rent status: nothing has fallen due, so it is
 * neither paid nor owing. Saying "paid" there would assert a settlement that never happened, so
 * this returns the tenancy's lifecycle instead and the screen shows the same word, from the same
 * badge, that the tenancy list shows for that row.
 */
export type TenancyRentStatus =
  | { kind: "rent"; status: RentStatus }
  | { kind: "notYetCharged"; lifecycle: LeaseLifecycle };

export function describeTenancyRentStatus({
  summary,
  lifecycle,
}: {
  summary: LeaseRentSummary;
  lifecycle: LeaseLifecycle;
}): TenancyRentStatus {
  // Anything that says money is owed wins, in that order, so that inconsistent data can never hide
  // arrears behind "nothing charged yet".
  if (summary.overduePeriodCount > 0) {
    return { kind: "rent", status: "overdue" };
  }
  if (summary.outstandingInAgorot > 0) {
    return { kind: "rent", status: "partial" };
  }
  // Only now is "nothing owed" true, and there are two different reasons for it: everything charged
  // has been paid, or nothing has been charged at all. They are not the same fact and must not read
  // as the same word.
  if (summary.periodsPayableCount === 0) {
    return { kind: "notYetCharged", lifecycle };
  }
  return { kind: "rent", status: "paid" };
}
