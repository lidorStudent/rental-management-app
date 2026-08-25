import { type IsoDate } from "@/lib/dates/isoDate";
import { describeLeaseLifecycle } from "@/lib/leases/describeLeaseLifecycle";

/**
 * Whether a unit is lived in, worked out from its tenancies and the day being asked about.
 *
 * There is no occupancy column on a unit, and there deliberately never will be. A stored flag is a
 * cached answer to this question that something has to remember to update: end a lease early and the
 * flag is wrong, record a tenancy starting next month and the flag is wrong. The leases already say
 * everything, so the answer is derived from them every time it is needed.
 */

export type LeaseForOccupancy = {
  startDate: IsoDate;
  endDate: IsoDate;
  tenantName: string | null;
};

export type UnitOccupancy =
  | { state: "occupied"; tenantName: string | null; endDate: IsoDate }
  | { state: "reserved"; startDate: IsoDate }
  | { state: "vacant" };

export function describeUnitOccupancy(
  leases: readonly LeaseForOccupancy[],
  currentDate: IsoDate,
): UnitOccupancy {
  const activeLease = leases.find(
    (lease) =>
      describeLeaseLifecycle({
        startDate: lease.startDate,
        endDate: lease.endDate,
        currentDate,
      }) === "active",
  );

  if (activeLease !== undefined) {
    return {
      state: "occupied",
      tenantName: activeLease.tenantName,
      endDate: activeLease.endDate,
    };
  }

  // A unit with a tenancy that has not started yet is not free to let again, so it is worth telling
  // apart from one that is genuinely empty.
  const upcomingLeases = leases.filter(
    (lease) =>
      describeLeaseLifecycle({
        startDate: lease.startDate,
        endDate: lease.endDate,
        currentDate,
      }) === "upcoming",
  );

  if (upcomingLeases.length > 0) {
    const soonest = upcomingLeases.reduce((earliest, lease) =>
      lease.startDate < earliest.startDate ? lease : earliest,
    );
    return { state: "reserved", startDate: soonest.startDate };
  }

  return { state: "vacant" };
}

/** The words for an occupancy, in one place so the list and the detail page agree. */
export function occupancyWords(occupancy: UnitOccupancy): string {
  if (occupancy.state === "occupied") {
    return occupancy.tenantName === null
      ? `Let until ${occupancy.endDate}, tenant account not created yet`
      : `${occupancy.tenantName}, until ${occupancy.endDate}`;
  }
  if (occupancy.state === "reserved") {
    return `Let from ${occupancy.startDate}`;
  }
  return "Vacant";
}
