import type { LeaseLifecycle } from "@/lib/leases/describeLeaseLifecycle";

/**
 * The line at the top of the tenant portal that says where their tenancy stands.
 *
 * A tenancy that has not started and one that has ended are ordinary states, not faults. A tenant
 * whose lease ended keeps everything they can see here, because their own rent history is theirs;
 * only reporting a new problem stops, and the wording says why.
 */
export function TenancyState({
  lifecycle,
  startDate,
  endDate,
}: {
  lifecycle: LeaseLifecycle;
  startDate: string;
  endDate: string;
}) {
  if (lifecycle === "active") {
    return null;
  }

  return (
    <p role="status" className="rounded-md border px-4 py-3 text-sm">
      {lifecycle === "upcoming"
        ? `Your tenancy starts on ${startDate}. Rent periods and problem reporting open on that day.`
        : `Your tenancy ended on ${endDate}. Everything here stays available to you; new problems go to your landlord directly.`}
    </p>
  );
}
