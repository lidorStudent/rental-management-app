import type { LeaseLifecycle } from "@/lib/leases/describeLeaseLifecycle";
import { cn } from "@/lib/classNames";

/**
 * The one place a lease's lifecycle is turned into a word. It receives the lifecycle rather than
 * the dates, so the rule that decides it stays in describeLeaseLifecycle.
 *
 * The colour is not chosen here. Each lifecycle names one of the five status meanings defined in
 * globals.css, so a lease that is running looks like rent that is paid and like a problem that is
 * resolved: they mean the same thing to the reader.
 */
const LIFECYCLE_STYLES: Record<LeaseLifecycle, { label: string; className: string }> = {
  upcoming: { label: "Upcoming", className: "status-badge-progress" },
  active: { label: "Active", className: "status-badge-settled" },
  ended: { label: "Ended", className: "status-badge-neutral" },
};

export function LeaseStatusBadge({ lifecycle }: { lifecycle: LeaseLifecycle }) {
  const style = LIFECYCLE_STYLES[lifecycle];

  return <span className={cn("status-badge", style.className)}>{style.label}</span>;
}
