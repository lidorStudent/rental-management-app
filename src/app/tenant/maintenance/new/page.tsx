import Link from "next/link";

import { MaintenanceRequestForm } from "@/components/maintenance/MaintenanceRequestForm";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { loadTenantLease } from "@/components/tenant/loadTenantLease";

export const metadata = { title: "Report a problem" };

/**
 * A problem can only be reported against a tenancy that is running. A tenant whose lease has ended,
 * or has not started, is told which of those it is rather than shown a form that would be refused.
 */
export default async function NewMaintenanceRequestPage() {
  const lease = await loadTenantLease();

  return (
    <div className="space-y-6">
      <Link href="/tenant/maintenance" className="text-muted-foreground text-sm underline">
        Back to your problems
      </Link>
      <PageHeader
        title="Report a problem"
        description="Your landlord sees this straight away, and you can follow what happens to it here."
      />

      {lease === null ? (
        <EmptyState
          title="No tenancy recorded yet"
          description="Problems are reported against a tenancy. Your landlord adds yours when your lease begins."
        />
      ) : null}

      {lease !== null && lease.lifecycle === "upcoming" ? (
        <EmptyState
          title={`Your tenancy starts on ${lease.startDate}`}
          description="You can report problems once you have moved in. Anything before then goes to your landlord directly."
        />
      ) : null}

      {lease !== null && lease.lifecycle === "ended" ? (
        <EmptyState
          title={`Your tenancy ended on ${lease.endDate}`}
          description="Everything you reported stays here to read. A new problem now goes to your landlord directly."
        />
      ) : null}

      {lease !== null && lease.lifecycle === "active" ? <MaintenanceRequestForm /> : null}
    </div>
  );
}
