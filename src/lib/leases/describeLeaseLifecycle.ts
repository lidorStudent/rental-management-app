import { assertValidIsoDate, type IsoDate } from "@/lib/dates/isoDate";

/**
 * Where a lease sits in its own life, worked out from its dates.
 *
 * There is no status column on a lease in this product. A tenancy that has not started yet, one
 * that is running, and one that has finished are three readings of the same two dates, and a stored
 * status would be a cached answer to that comparison that something would have to keep current.
 *
 * Both endpoints belong to the tenancy, matching the exclusion constraint: a lease that ends on the
 * 31st is still active on the 31st.
 */

export type LeaseLifecycle = "upcoming" | "active" | "ended";

export function describeLeaseLifecycle({
  startDate,
  endDate,
  currentDate,
}: {
  startDate: IsoDate;
  endDate: IsoDate;
  currentDate: IsoDate;
}): LeaseLifecycle {
  assertValidIsoDate(startDate, "The lease start date");
  assertValidIsoDate(endDate, "The lease end date");
  assertValidIsoDate(currentDate, "The current date");

  if (currentDate < startDate) {
    return "upcoming";
  }
  if (currentDate > endDate) {
    return "ended";
  }
  return "active";
}

/**
 * The lease a tenant is living under today, or null when none is.
 *
 * The product assumes one tenancy per tenant, and the exclusion constraint guarantees only that a
 * unit is not let twice. A tenant renting two flats at once is possible in the data model and not
 * in the product, so the most recently started active lease is chosen rather than failing.
 */
export function findActiveLease<TLease extends { startDate: IsoDate; endDate: IsoDate }>(
  leases: readonly TLease[],
  currentDate: IsoDate,
): TLease | null {
  const active = leases.filter(
    (lease) =>
      describeLeaseLifecycle({
        startDate: lease.startDate,
        endDate: lease.endDate,
        currentDate,
      }) === "active",
  );

  if (active.length === 0) {
    return null;
  }

  return active.reduce((latest, lease) => (lease.startDate > latest.startDate ? lease : latest));
}

/**
 * The tenancy a tenant's portal should be about.
 *
 * A tenant usually has exactly one. Where they have several, because a tenancy was renewed, the one
 * that is running wins; failing that the one about to start, because that is the news; failing that
 * the one that ended most recently, because their own history stays theirs after they move out.
 */
export function chooseCurrentLease<TLease extends { startDate: IsoDate; endDate: IsoDate }>(
  leases: readonly TLease[],
  currentDate: IsoDate,
): TLease | null {
  const active = findActiveLease(leases, currentDate);
  if (active !== null) {
    return active;
  }

  const upcoming = leases.filter(
    (lease) =>
      describeLeaseLifecycle({
        startDate: lease.startDate,
        endDate: lease.endDate,
        currentDate,
      }) === "upcoming",
  );
  if (upcoming.length > 0) {
    return upcoming.reduce((soonest, lease) =>
      lease.startDate < soonest.startDate ? lease : soonest,
    );
  }

  if (leases.length === 0) {
    return null;
  }

  return leases.reduce((latest, lease) => (lease.endDate > latest.endDate ? lease : latest));
}
