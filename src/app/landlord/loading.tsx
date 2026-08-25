import { PanelSkeleton } from "@/components/shared/PanelSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Next.js wraps the page in a Suspense boundary with this as the fallback, so the navigation stays
 * put and only the part that is still loading is drawn as a shape. A page that has several
 * independent sections wraps each one in its own Suspense boundary, so a slow list does not hold up
 * the figures beside it.
 */
export default function LandlordLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <PanelSkeleton />
        <PanelSkeleton />
      </div>
    </div>
  );
}
