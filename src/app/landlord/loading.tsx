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
      {/*
        One strip of three tiles, because that is what the rent overview puts under its heading: a
        `dl` of three figures in a single bordered grid. Two panels side by side stood for nothing
        on that page, and a fallback shaped differently from what replaces it makes the reader watch
        the layout rearrange itself.

        The overrides turn this component from a card into a strip of tiles, the same trick the
        dashboard and the tenant overview use. Those two also pass `border-0`; this one does not,
        because the strip it stands in for has a border, and keeping it is what makes the two agree
        to the pixel: 1104 wide, 70 tall, three 68-pixel tiles on identical column tracks. Measured
        rather than guessed.
      */}
      <PanelSkeleton
        lineCount={2}
        className="grid gap-px space-y-0 overflow-hidden bg-border p-0 sm:grid-cols-3"
        lineClassName="h-[68px] w-full rounded-none"
      />
    </div>
  );
}
