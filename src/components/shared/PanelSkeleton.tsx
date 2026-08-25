import { Skeleton } from "@/components/ui/skeleton";

/** The same idea as TableSkeleton, for a panel of figures: the dashboard totals, a lease summary. */
export function PanelSkeleton({ lineCount = 3 }: { lineCount?: number }) {
  return (
    <div className="space-y-3 rounded-md border p-4" aria-hidden="true">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: lineCount }, (_, line) => (
        <Skeleton key={line} className="h-4 w-full" />
      ))}
    </div>
  );
}
