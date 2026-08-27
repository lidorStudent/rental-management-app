import type { MaintenanceStatus } from "@/lib/maintenance/allowedStatusTransitions";
import { cn } from "@/lib/classNames";

/**
 * The one place a maintenance status becomes a word. Each status names one of the five status
 * meanings defined in globals.css, which is where the colour lives. A problem nobody has looked at
 * yet is critical, the same meaning as rent that is overdue.
 */
const STATUS_STYLES: Record<MaintenanceStatus, { label: string; className: string }> = {
  submitted: { label: "Reported", className: "status-badge-critical" },
  acknowledged: { label: "Acknowledged", className: "status-badge-attention" },
  in_progress: { label: "In progress", className: "status-badge-progress" },
  resolved: { label: "Resolved", className: "status-badge-settled" },
};

export function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  const style = STATUS_STYLES[status];

  return <span className={cn("status-badge", style.className)}>{style.label}</span>;
}

export const URGENCY_WORDS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  urgent: "Urgent",
};
