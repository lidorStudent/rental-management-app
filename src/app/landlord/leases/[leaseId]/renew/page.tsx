import Link from "next/link";
import { notFound } from "next/navigation";

import { RenewLeaseForm } from "@/components/leases/RenewLeaseForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { nextDay } from "@/lib/dates/isoDate";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const metadata = { title: "Renew a tenancy" };

/**
 * The renewal is offered starting the day after the current tenancy ends, because that tenancy owns
 * its own last day. Choosing anything earlier is refused by the overlap rule, and the form says so
 * before the landlord tries.
 */
export default async function RenewLeasePage({ params }: { params: Promise<{ leaseId: string }> }) {
  const { leaseId } = await params;
  const supabaseClient = await createSupabaseServerClient();

  const { data: lease } = await supabaseClient
    .from("leases")
    .select(
      "id, end_date, rent_amount_cents, rent_due_day, units(label, properties(name)), tenant:profiles!leases_tenant_profile_id_fkey(full_name)",
    )
    .eq("id", leaseId)
    .maybeSingle();

  if (lease === null) {
    notFound();
  }

  const tenantName = lease.tenant?.full_name ?? "the same tenant, once their account exists";

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href={`/landlord/leases/${lease.id}`}
        className="text-muted-foreground text-sm underline"
      >
        Back to the tenancy
      </Link>
      <PageHeader
        title="Renew this tenancy"
        description={`A new agreement for ${lease.units.label} at ${lease.units.properties.name}, with ${tenantName}. The current one runs to ${lease.end_date}.`}
      />
      <RenewLeaseForm
        leaseId={lease.id}
        earliestStartDate={nextDay(lease.end_date)}
        currentRentAmount={(lease.rent_amount_cents / 100).toFixed(2)}
        currentRentDueDay={lease.rent_due_day}
      />
    </div>
  );
}
