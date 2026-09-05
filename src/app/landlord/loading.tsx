import { PanelSkeleton } from "@/components/shared/PanelSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Next.js wraps the page in a Suspense boundary with this as the fallback, so the navigation stays
 * put and only the part that is still loading is drawn as a shape. A page that has several
 * independent sections wraps each one in its own Suspense boundary, so a slow list does not hold up
 * the figures beside it.
 *
 * One card, the same shape the tenant area uses. This file stands in for all eighteen landlord
 * routes and cannot match every one of them, so it draws the shape most of them load: a heading, a
 * subtitle, and a bordered card of full-width bars that reads as a table on its way. A fallback that
 * matched one page exactly would be further from the rest of them than this is.
 */
export default function LandlordLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <PanelSkeleton lineCount={4} />
    </div>
  );
}
