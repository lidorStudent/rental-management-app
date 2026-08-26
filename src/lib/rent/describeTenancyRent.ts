import { describeLeaseLifecycle, type LeaseLifecycle } from "@/lib/leases/describeLeaseLifecycle";
import {
  summariseLeaseRentFromTotal,
  type LeaseRentSummary,
} from "@/lib/rent/summariseOutstandingRent";

/**
 * One row of `lease_rent_summary` turned into what a screen shows: where the tenancy is in its life,
 * and where it stands on rent.
 *
 * Two screens read that view, the dashboard and the rent overview, and each had its own copy of this
 * mapping until they were merged. The reason it needs a function at all is the nullability: Postgres
 * does not promise a view's columns the way it promises a table's, so every column arrives as
 * possibly null and the fallbacks belong in one place rather than in each caller.
 */
export type TenancyRentRow = {
  lease_id: string | null;
  unit_label: string | null;
  property_name: string | null;
  tenant_full_name: string | null;
  start_date: string | null;
  end_date: string | null;
  rent_amount_cents: number | null;
  rent_due_day: number | null;
  total_paid_cents: number | null;
};

export type TenancyRent = {
  leaseId: string;
  unitLabel: string;
  propertyName: string;
  tenantName: string | null;
  startDate: string;
  endDate: string;
  lifecycle: LeaseLifecycle;
  summary: LeaseRentSummary;
};

export function describeTenancyRent(row: TenancyRentRow, currentDate: string): TenancyRent {
  const lease = {
    startDate: row.start_date ?? currentDate,
    endDate: row.end_date ?? currentDate,
    rentAmountInAgorot: row.rent_amount_cents ?? 0,
    // A missing due day is the first of the month, which is the commonest one anyway.
    rentDueDay: row.rent_due_day ?? 1,
  };

  return {
    leaseId: row.lease_id ?? "",
    unitLabel: row.unit_label ?? "",
    propertyName: row.property_name ?? "",
    tenantName: row.tenant_full_name,
    startDate: lease.startDate,
    endDate: lease.endDate,
    lifecycle: describeLeaseLifecycle({ ...lease, currentDate }),
    summary: summariseLeaseRentFromTotal({
      lease,
      // bigint columns arrive as strings when they are large enough, so this is not decoration.
      totalPaidInAgorot: Number(row.total_paid_cents ?? 0),
      currentDate,
    }),
  };
}
