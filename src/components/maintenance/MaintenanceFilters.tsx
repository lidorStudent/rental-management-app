import Link from "next/link";

import { cn } from "@/lib/classNames";

/**
 * Two filters, both in the URL: what state a problem is in and how urgent it is. Links rather than
 * a control with state, so a landlord can bookmark "everything urgent and still open".
 */
export const STATUS_FILTERS = ["all", "open", "resolved"] as const;
export const URGENCY_FILTERS = ["all", "urgent", "normal", "low"] as const;

export type MaintenanceStatusFilter = (typeof STATUS_FILTERS)[number];
export type MaintenanceUrgencyFilter = (typeof URGENCY_FILTERS)[number];

const STATUS_LABELS: Record<MaintenanceStatusFilter, string> = {
  all: "All",
  open: "Open",
  resolved: "Resolved",
};

const URGENCY_LABELS: Record<MaintenanceUrgencyFilter, string> = {
  all: "Any urgency",
  urgent: "Urgent",
  normal: "Normal",
  low: "Low",
};

export function parseStatusFilter(value: string | undefined): MaintenanceStatusFilter {
  return STATUS_FILTERS.find((filter) => filter === value) ?? "all";
}

export function parseUrgencyFilter(value: string | undefined): MaintenanceUrgencyFilter {
  return URGENCY_FILTERS.find((filter) => filter === value) ?? "all";
}

export function MaintenanceFilters({
  status,
  urgency,
}: {
  status: MaintenanceStatusFilter;
  urgency: MaintenanceUrgencyFilter;
}) {
  return (
    <div className="flex flex-wrap gap-4">
      <nav aria-label="Filter by state" className="flex flex-wrap gap-1">
        {STATUS_FILTERS.map((filter) => (
          <FilterLink
            key={filter}
            href={buildHref({ status: filter, urgency })}
            label={STATUS_LABELS[filter]}
            isCurrent={filter === status}
          />
        ))}
      </nav>

      <nav aria-label="Filter by urgency" className="flex flex-wrap gap-1">
        {URGENCY_FILTERS.map((filter) => (
          <FilterLink
            key={filter}
            href={buildHref({ status, urgency: filter })}
            label={URGENCY_LABELS[filter]}
            isCurrent={filter === urgency}
          />
        ))}
      </nav>
    </div>
  );
}

function FilterLink({
  href,
  label,
  isCurrent,
}: {
  href: string;
  label: string;
  isCurrent: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={isCurrent ? "true" : undefined}
      className={cn(
        "hover:bg-accent hover:text-foreground text-muted-foreground rounded-md border px-3 py-1.5 text-sm",
        isCurrent && "bg-accent text-foreground font-medium",
      )}
    >
      {label}
    </Link>
  );
}

export function buildHref({
  status,
  urgency,
}: {
  status: MaintenanceStatusFilter;
  urgency: MaintenanceUrgencyFilter;
}): string {
  const parameters = new URLSearchParams();
  if (status !== "all") {
    parameters.set("status", status);
  }
  if (urgency !== "all") {
    parameters.set("urgency", urgency);
  }
  const query = parameters.toString();
  return query === "" ? "/landlord/maintenance" : `/landlord/maintenance?${query}`;
}
