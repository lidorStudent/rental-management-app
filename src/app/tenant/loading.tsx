import { PanelSkeleton } from "@/components/shared/PanelSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function TenantLoading() {
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
