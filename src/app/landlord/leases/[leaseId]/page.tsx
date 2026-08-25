import Link from "next/link";
import { notFound } from "next/navigation";

import { LeaseStatusBadge } from "@/components/leases/LeaseStatusBadge";
import { TenantAccessPanel } from "@/components/leases/TenantAccessPanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { currentIsoDateInUtc } from "@/lib/dates/currentDate";
import { describeLeaseLifecycle } from "@/lib/leases/describeLeaseLifecycle";
import { formatCentsAsCurrency } from "@/lib/money/formatCentsAsCurrency";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

/**
 * One tenancy: what was agreed, who is in it, and the two things that can be done to it.
 *
 * A tenancy is not edited here. It is ended, which brings its end date forward, or renewed, which
 * writes the next one. Both are recorded in the technical plan as decisions: a lease is a record of
 * an agreement, and a form that re-types the rent on a running tenancy is how history gets quietly
 * rewritten.
 */
export default async function LeaseDetailPage({
  params,
}: {
  params: Promise<{ leaseId: string }>;
}) {
  const { leaseId } = await params;
  const supabaseClient = await createSupabaseServerClient();

  const { data: lease } = await supabaseClient
    .from("leases")
    .select(
      "id, start_date, end_date, rent_amount_cents, deposit_amount_cents, rent_due_day, unit_id, units(label, property_id, properties(name, address_line, city)), tenant:profiles!leases_tenant_profile_id_fkey(full_name, email, must_change_password)",
    )
    .eq("id", leaseId)
    .maybeSingle();

  if (lease === null) {
    notFound();
  }

  const lifecycle = describeLeaseLifecycle({
    startDate: lease.start_date,
    endDate: lease.end_date,
    currentDate: currentIsoDateInUtc(),
  });

  return (
    <div className="space-y-8">
      <Link href="/landlord/leases" className="text-muted-foreground text-sm underline">
        Back to leases
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={`${lease.units.label} - ${lease.units.properties.name}`}
          description={`${lease.units.properties.address_line}, ${lease.units.properties.city}`}
        />
        <div className="flex items-center gap-2">
          <LeaseStatusBadge lifecycle={lifecycle} />
          {lifecycle === "ended" ? null : (
            <Link
              href={`/landlord/leases/${lease.id}/end`}
              className="hover:bg-accent inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
            >
              End early
            </Link>
          )}
          <Link
            href={`/landlord/leases/${lease.id}/renew`}
            className="hover:bg-accent inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
          >
            Renew
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Terms</h2>
        <dl className="divide-y rounded-md border text-sm">
          <Row label="Runs from" value={lease.start_date} />
          <Row label="Until, inclusive" value={lease.end_date} />
          <Row label="Monthly rent" value={formatCentsAsCurrency(lease.rent_amount_cents)} />
          <Row label="Rent due" value={`Day ${lease.rent_due_day} of each month`} />
          <Row
            label="Deposit"
            value={
              lease.deposit_amount_cents === 0
                ? "None recorded"
                : formatCentsAsCurrency(lease.deposit_amount_cents)
            }
          />
          <Row
            label="Unit"
            value={lease.units.label}
            href={`/landlord/properties/${lease.units.property_id}`}
          />
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Tenant access</h2>
        <TenantAccessPanel
          leaseId={lease.id}
          tenant={
            lease.tenant === null
              ? null
              : {
                  fullName: lease.tenant.full_name,
                  email: lease.tenant.email,
                  mustChangePassword: lease.tenant.must_change_password,
                }
          }
        />
      </section>
    </div>
  );
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">
        {href === undefined ? (
          value
        ) : (
          <Link href={href} className="underline">
            {value}
          </Link>
        )}
      </dd>
    </div>
  );
}
