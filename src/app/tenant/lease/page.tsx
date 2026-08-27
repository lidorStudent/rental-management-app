import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { TenancyState } from "@/components/tenant/TenancyState";
import { loadTenantLease } from "@/components/tenant/loadTenantLease";
import { formatCentsAsCurrency } from "@/lib/money/formatCentsAsCurrency";

export const metadata = { title: "Your lease" };

/**
 * The tenancy in full: where it is, what it costs, when it runs, and who to contact.
 *
 * There is no lease id in this URL. The tenancy comes from the session, so there is nothing here to
 * change in the address bar and nothing to verify against a signed-in user, because no identifier
 * arrived from the client in the first place.
 */
export default async function TenantLeasePage() {
  const lease = await loadTenantLease();

  if (lease === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Your lease" />
        <EmptyState
          title="No tenancy recorded yet"
          description="Your landlord adds your tenancy here when your lease begins. Nothing is missing on your side."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Your lease" description="What was agreed, and who to speak to about it." />

      <TenancyState
        lifecycle={lease.lifecycle}
        startDate={lease.startDate}
        endDate={lease.endDate}
      />

      <section className="space-y-3">
        <h2 className="section-title">Your home</h2>
        <dl className="bg-card divide-y rounded-md border text-sm">
          <Row label="Unit" value={lease.unitLabel} />
          <Row
            label="Address"
            value={[lease.addressLine, lease.city, lease.postalCode]
              .filter((part) => part !== null && part !== "")
              .join(", ")}
          />
          {lease.bedroomCount === null ? null : (
            <Row label="Bedrooms" value={String(lease.bedroomCount)} />
          )}
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Terms</h2>
        <dl className="bg-card divide-y rounded-md border text-sm">
          <Row label="Runs from" value={lease.startDate} />
          <Row label="Until, inclusive" value={lease.endDate} />
          <Row label="Monthly rent" value={formatCentsAsCurrency(lease.rentAmountInAgorot)} />
          <Row label="Rent due" value={`Day ${lease.rentDueDay} of each month`} />
          <Row
            label="Deposit"
            value={
              lease.depositAmountInAgorot === 0
                ? "None recorded"
                : formatCentsAsCurrency(lease.depositAmountInAgorot)
            }
          />
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Your landlord</h2>
        <dl className="bg-card divide-y rounded-md border text-sm">
          <Row label="Name" value={lease.landlordName ?? "Not recorded"} />
          <Row label="Email" value={lease.landlordEmail ?? "Not recorded"} />
        </dl>
        <p className="text-muted-foreground text-sm">
          Anything this portal does not cover goes to them directly. Rent is recorded here by your
          landlord when it arrives; it is not collected through this application.
        </p>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}
