import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PanelSkeleton } from "@/components/shared/PanelSkeleton";
import { TenancyState } from "@/components/tenant/TenancyState";
import { TenantRentPosition } from "@/components/tenant/TenantRentPosition";
import { loadTenantLease } from "@/components/tenant/loadTenantLease";

export const metadata = { title: "Your tenancy" };

/**
 * The answer to the only question most tenants have, above everything else: what is owed, and is
 * anything late.
 */
export default async function TenantPortalPage() {
  const lease = await loadTenantLease();

  if (lease === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Your tenancy" />
        <EmptyState
          title="No tenancy recorded yet"
          description="Your landlord adds your tenancy here when your lease begins. Nothing is missing on your side."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your tenancy"
        description={`${lease.unitLabel}, ${lease.addressLine}, ${lease.city}`}
      />

      <TenancyState
        lifecycle={lease.lifecycle}
        startDate={lease.startDate}
        endDate={lease.endDate}
      />

      <Suspense fallback={<PanelSkeleton lineCount={2} />}>
        <TenantRentPosition lease={lease} />
      </Suspense>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/tenant/payments"
          className="hover:bg-accent inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
        >
          Every payment
        </Link>
        <Link
          href="/tenant/lease"
          className="hover:bg-accent inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
        >
          Your lease
        </Link>
        <Link
          href="/tenant/maintenance/new"
          className="hover:bg-accent inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
        >
          Report a problem
        </Link>
      </div>
    </div>
  );
}
