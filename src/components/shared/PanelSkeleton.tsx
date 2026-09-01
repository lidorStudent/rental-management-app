import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/classNames";

/**
 * The same idea as TableSkeleton, for a panel of figures: the dashboard totals, a lease summary.
 *
 * The two callers are grids of figures rather than stacks of lines, so both pass the grid they are
 * standing in for and the size of one tile. A fallback shaped differently from what replaces it is
 * worse than none: the reader watches the page rearrange itself under them.
 *
 * The bar count is one more than lineCount, because the first bar stands for the first tile.
 */
export function PanelSkeleton({
  lineCount = 3,
  className,
  lineClassName,
}: {
  lineCount?: number;
  className?: string;
  lineClassName?: string;
}) {
  return (
    <div
      className={cn("bg-card space-y-3 rounded-md border p-4", className)}
      aria-hidden="true"
    >
      <Skeleton className={cn("h-4 w-32", lineClassName)} />
      {Array.from({ length: lineCount }, (_, line) => (
        <Skeleton key={line} className={cn("h-4 w-full", lineClassName)} />
      ))}
    </div>
  );
}
