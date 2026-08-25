import type { RentStatus } from "@/lib/rent/deriveRentStatus";
import { cn } from "@/lib/classNames";

/**
 * The single place a derived rent status becomes a word and a colour. It takes the status rather
 * than the numbers, so the rule that decides it stays in deriveRentStatus and nothing here can
 * disagree with it.
 */
const STATUS_STYLES: Record<RentStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "border-emerald-600/30 text-emerald-700" },
  partial: { label: "Part paid", className: "border-amber-600/40 text-amber-700" },
  due: { label: "Due", className: "border-muted-foreground/30 text-muted-foreground" },
  overdue: {
    label: "Overdue",
    className: "border-red-600/40 bg-red-50 font-semibold text-red-700",
  },
};

export function RentStatusBadge({ status }: { status: RentStatus }) {
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
