import { Suspense } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { PanelSkeleton } from "@/components/shared/PanelSkeleton";
import { TenancySummary } from "@/components/tenant/TenancySummary";

export const metadata = { title: "Your tenancy" };

export default function TenantPortalPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Your tenancy" description="What you rent, and what you owe." />

      <Suspense fallback={<PanelSkeleton lineCount={4} />}>
        <TenancySummary />
      </Suspense>
    </div>
  );
}
