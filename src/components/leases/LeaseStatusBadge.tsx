import type { LeaseLifecycle } from "@/lib/leases/describeLeaseLifecycle";
import { cn } from "@/lib/classNames";

/**
 * The one place a lease's lifecycle is turned into a word and a colour. It receives the lifecycle
 * rather than the dates, so the rule that decides it stays in describeLeaseLifecycle.
 */
const LIFECYCLE_STYLES: Record<LeaseLifecycle, { label: string; className: string }> = {
  upcoming: { label: "Upcoming", className: "border-blue-600/30 text-blue-700" },
  active: { label: "Active", className: "border-emerald-600/30 text-emerald-700" },
  ended: { label: "Ended", className: "border-muted-foreground/30 text-muted-foreground" },
};

export function LeaseStatusBadge({ lifecycle }: { lifecycle: LeaseLifecycle }) {
  const style = LIFECYCLE_STYLES[lifecycle];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}
