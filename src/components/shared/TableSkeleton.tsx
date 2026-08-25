import { Skeleton } from "@/components/ui/skeleton";

/**
 * What a table looks like while its rows are still being read.
 *
 * It keeps the shape of the thing that is coming, rather than replacing the page with a spinner: the
 * heading and the controls around it stay where they are, so nothing jumps when the rows arrive.
 */
export function TableSkeleton({
  columnCount,
  rowCount = 5,
}: {
  columnCount: number;
  rowCount?: number;
}) {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="rounded-md border">
        <div className="flex gap-4 border-b px-4 py-3">
          {Array.from({ length: columnCount }, (_, column) => (
            <Skeleton key={column} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rowCount }, (_, row) => (
          <div key={row} className="flex gap-4 border-b px-4 py-3 last:border-b-0">
            {Array.from({ length: columnCount }, (_, column) => (
              <Skeleton key={column} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
      <Skeleton className="h-4 w-48" />
    </div>
  );
}
