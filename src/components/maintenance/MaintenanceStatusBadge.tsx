import type { MaintenanceStatus } from "@/lib/maintenance/allowedStatusTransitions";
import { cn } from "@/lib/classNames";

/** The one place a maintenance status becomes a word and a colour. */
const STATUS_STYLES: Record<MaintenanceStatus, { label: string; className: string }> = {
  submitted: { label: "Reported", className: "border-red-600/40 bg-red-50 text-red-700" },
  acknowledged: { label: "Acknowledged", className: "border-amber-600/40 text-amber-700" },
  in_progress: { label: "In progress", className: "border-blue-600/30 text-blue-700" },
  resolved: { label: "Resolved", className: "border-emerald-600/30 text-emerald-700" },
};

export function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  const style = STATUS_STYLES[status];

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

export const URGENCY_WORDS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  urgent: "Urgent",
};
