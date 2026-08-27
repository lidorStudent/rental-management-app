import type { RentStatus } from "@/lib/rent/deriveRentStatus";
import { cn } from "@/lib/classNames";

/**
 * The single place a derived rent status becomes a word. It takes the status rather than the
 * numbers, so the rule that decides it stays in deriveRentStatus and nothing here can disagree
 * with it.
 *
 * Each status names one of the five status meanings defined in globals.css, which is where the
 * colour lives. Overdue is the critical one: the only meaning painted as a solid fill, so it is
 * still the loudest thing in the table when the colour is taken away.
 */
const STATUS_STYLES: Record<RentStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "status-badge-settled" },
  partial: { label: "Part paid", className: "status-badge-attention" },
  due: { label: "Due", className: "status-badge-neutral" },
  overdue: { label: "Overdue", className: "status-badge-critical" },
};

export function RentStatusBadge({ status }: { status: RentStatus }) {
  const style = STATUS_STYLES[status];

  return <span className={cn("status-badge", style.className)}>{style.label}</span>;
}
