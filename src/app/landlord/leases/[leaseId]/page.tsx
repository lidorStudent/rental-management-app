import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LeaseActionLinks } from "@/components/leases/LeaseActionLinks";
import { LeasePaymentHistory } from "@/components/leases/LeasePaymentHistory";
import { LeaseRentSchedule } from "@/components/leases/LeaseRentSchedule";
import { LeaseStatusBadge } from "@/components/leases/LeaseStatusBadge";
import { LeaseTermsPanel } from "@/components/leases/LeaseTermsPanel";
import { TenantAccessPanel } from "@/components/leases/TenantAccessPanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { currentIsoDateInUtc } from "@/lib/dates/currentDate";
import { describeLeaseLifecycle } from "@/lib/leases/describeLeaseLifecycle";
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
  searchParams,
}: {
  params: Promise<{ leaseId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { leaseId } = await params;
  const { page } = await searchParams;
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
          <LeaseActionLinks leaseId={lease.id} lifecycle={lifecycle} />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Terms</h2>
        <LeaseTermsPanel
          lease={{
            startDate: lease.start_date,
            endDate: lease.end_date,
            rentAmountInAgorot: lease.rent_amount_cents,
            depositAmountInAgorot: lease.deposit_amount_cents,
            rentDueDay: lease.rent_due_day,
            unitLabel: lease.units.label,
            propertyId: lease.units.property_id,
          }}
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Rent</h2>
          <Link
            href={`/landlord/leases/${lease.id}/payments/new`}
            className="hover:bg-accent inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
          >
            Record a payment
          </Link>
        </div>
        {/* Each section reads its own data behind its own boundary, so a slow ledger does not hold
            up the terms above it. */}
        <Suspense fallback={<TableSkeleton columnCount={6} />}>
          <LeaseRentSchedule
            leaseId={lease.id}
            lease={{
              startDate: lease.start_date,
              endDate: lease.end_date,
              rentAmountInAgorot: lease.rent_amount_cents,
              rentDueDay: lease.rent_due_day,
            }}
          />
        </Suspense>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Payments received</h2>
        <Suspense fallback={<TableSkeleton columnCount={6} rowCount={3} />}>
          <LeasePaymentHistory leaseId={lease.id} page={page} />
        </Suspense>
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
