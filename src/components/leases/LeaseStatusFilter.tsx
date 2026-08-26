import Link from "next/link";

import { cn } from "@/lib/classNames";

/**
 * The status filter is four links, not a dropdown, because the choice belongs in the URL: a landlord
 * who wants to look at what is ending can bookmark it, and the server reads it back on the next
 * request. There is no client state here at all.
 */
const LEASE_STATUS_FILTERS = ["all", "active", "upcoming", "ended"] as const;

export type LeaseStatusFilter = (typeof LEASE_STATUS_FILTERS)[number];

const FILTER_LABELS: Record<LeaseStatusFilter, string> = {
  all: "All",
  active: "Active",
  upcoming: "Upcoming",
  ended: "Ended",
};

export function parseLeaseStatusFilter(value: string | undefined): LeaseStatusFilter {
  return LEASE_STATUS_FILTERS.find((filter) => filter === value) ?? "all";
}

export function LeaseStatusFilterLinks({ current }: { current: LeaseStatusFilter }) {
  return (
    <nav aria-label="Filter tenancies" className="flex flex-wrap gap-1">
      {LEASE_STATUS_FILTERS.map((filter) => (
        <Link
          key={filter}
          href={filter === "all" ? "/landlord/leases" : `/landlord/leases?status=${filter}`}
          aria-current={filter === current ? "true" : undefined}
          className={cn(
            "hover:bg-accent hover:text-foreground text-muted-foreground rounded-md border px-3 py-1.5 text-sm",
            filter === current && "bg-accent text-foreground font-medium",
          )}
        >
          {FILTER_LABELS[filter]}
        </Link>
      ))}
    </nav>
  );
}
