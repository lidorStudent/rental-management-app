import { Suspense } from "react";

import { PortfolioSummary } from "@/components/dashboard/PortfolioSummary";
import { PageHeader } from "@/components/shared/PageHeader";
import { PanelSkeleton } from "@/components/shared/PanelSkeleton";

export const metadata = { title: "Dashboard" };

/**
 * Each section of a page fetches its own data behind its own Suspense boundary, so a slow query
 * draws one skeleton rather than holding up the whole page. The attention panel, the leases ending
 * soon and the outstanding total arrive as further sections, in the same shape as this one.
 */
export default function LandlordDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="What needs attention across your portfolio." />

      <Suspense fallback={<PanelSkeleton lineCount={2} />}>
        <PortfolioSummary />
      </Suspense>
    </div>
  );
}
