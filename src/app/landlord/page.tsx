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
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="What needs attention across your portfolio." />

      <Suspense fallback={<PanelSkeleton lineCount={3} />}>
        <DashboardOverview />
      </Suspense>
    </div>
  );
}
