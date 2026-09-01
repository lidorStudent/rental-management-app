import { Suspense } from "react";

import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { PageHeader } from "@/components/shared/PageHeader";
import { PanelSkeleton } from "@/components/shared/PanelSkeleton";

export const metadata = { title: "Dashboard" };

/**
 * One Suspense boundary rather than several, because the figures on this page share their data: the
 * same query answers what is overdue, how many units are let, and which tenancies end soon.
 * Splitting them into separately suspended sections would mean fetching those rows three times.
 */
export default function LandlordDashboardPage() {
  return (
    <div className="dashboard-page space-y-6">
      <PageHeader title="Dashboard" description="What needs attention across your portfolio." />

      <Suspense
        fallback={
          <PanelSkeleton
            lineCount={3}
            className="grid gap-px space-y-0 overflow-hidden border-0 bg-border p-0 sm:grid-cols-2 lg:grid-cols-4"
            lineClassName="h-[86px] w-full rounded-none"
          />
        }
      >
        <DashboardOverview />
      </Suspense>
    </div>
  );
}
