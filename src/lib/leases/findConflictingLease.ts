import { assertValidIsoDate, type IsoDate } from "@/lib/dates/isoDate";

/**
 * Domain invariant 1: a unit is never let to two tenants over the same dates.
 *
 * The guarantee lives in the database, as the leases_no_overlap exclusion constraint, because a
 * read-then-write check in application code is a race: two landlords, or one landlord with two
 * tabs, can both read "no conflict" before either writes. This function exists for the other half
 * of the job, telling the landlord which existing lease is in the way, and it has to agree with the
 * constraint exactly or the form will accept a lease that Postgres then rejects.
 *
 * Both endpoints are occupied, matching daterange(start_date, end_date, '[]'). A lease that ends on
 * the 31st still owns the 31st, so the next tenancy starts on the 1st. The handover day belongs to
 * the outgoing tenant, who is still paying for it.
 */

export type ExistingLease = {
  leaseId: string;
  unitId: string;
  startDate: IsoDate;
  endDate: IsoDate;
};

export type ProposedLease = {
  unitId: string;
  startDate: IsoDate;
  endDate: IsoDate;
  /**
   * Set when an existing lease is being edited, so that the lease does not collide with the version
   * of itself already stored. Absent when a lease is being created.
   */
  leaseIdBeingEdited?: string;
};

/**
 * Returns the conflicting lease, or null when the proposed dates are free.
 *
 * When several leases conflict, the earliest one is returned, so that the message a landlord sees
 * does not change between two runs over the same data.
 */
export function findConflictingLease(
  proposed: ProposedLease,
  existingLeases: readonly ExistingLease[],
): ExistingLease | null {
  assertValidIsoDate(proposed.startDate, "The proposed start date");
  assertValidIsoDate(proposed.endDate, "The proposed end date");

  if (proposed.endDate <= proposed.startDate) {
    throw new Error(
      `A lease must end after it starts, and ${proposed.startDate} to ${proposed.endDate} does not.`,
    );
  }

  let earliestConflict: ExistingLease | null = null;

  for (const existingLease of existingLeases) {
    if (!isComparable(existingLease, proposed)) {
      continue;
    }
    assertValidIsoDate(existingLease.startDate, `The start date of lease ${existingLease.leaseId}`);
    assertValidIsoDate(existingLease.endDate, `The end date of lease ${existingLease.leaseId}`);

    if (!datesOverlap(proposed, existingLease)) {
      continue;
    }
    if (earliestConflict === null || existingLease.startDate < earliestConflict.startDate) {
      earliestConflict = existingLease;
    }
  }

  return earliestConflict;
}

/**
 * A lease is compared only when it is on the same unit and is not the lease being edited.
 *
 * Every other lease on the unit counts, whether it ended last year or starts next year: a lease has
 * no status in this product, its dates are its lifecycle, and a tenancy that has ended still owns
 * the dates it ran for. Recording a new lease over a period already let would leave a rent ledger
 * that claims two tenants owed rent for the same flat in the same month.
 */
function isComparable(existingLease: ExistingLease, proposed: ProposedLease): boolean {
  if (existingLease.unitId !== proposed.unitId) {
    return false;
  }
  return existingLease.leaseId !== proposed.leaseIdBeingEdited;
}

/**
 * Two inclusive date ranges overlap when each starts on or before the other ends. Dates in
 * YYYY-MM-DD form compare correctly as text, so this is the whole rule.
 */
function datesOverlap(
  first: { startDate: IsoDate; endDate: IsoDate },
  second: ExistingLease,
): boolean {
  return first.startDate <= second.endDate && second.startDate <= first.endDate;
}
