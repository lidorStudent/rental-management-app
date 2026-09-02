import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailRow } from "@/components/shared/DetailRow";

import {
  MaintenanceStatusBadge,
  URGENCY_WORDS,
} from "@/components/maintenance/MaintenanceStatusBadge";
import { MaintenanceStatusControl } from "@/components/maintenance/MaintenanceStatusControl";
import { PageHeader } from "@/components/shared/PageHeader";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

/**
 * One reported problem, its history, and the moves that are legal from where it is.
 *
 * A request is never deleted here, by either party. Closing one is a status, so the record of what
 * was reported and when survives, which is the point of taking it out of a chat thread.
 */
export default async function MaintenanceRequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const supabaseClient = await createSupabaseServerClient();

  const { data: request } = await supabaseClient
    .from("maintenance_requests")
    .select(
      "id, title, description, urgency, status, created_at, resolved_at, tenant_confirmed_at, lease_id, leases(unit_id, units(label, property_id, properties(name, address_line, city))), submitted_by_profile:profiles!maintenance_requests_submitted_by_fkey(full_name)",
    )
    .eq("id", requestId)
    .maybeSingle();

  if (request === null) {
    notFound();
  }

  return (
    <div className="max-w-3xl space-y-8">
      <Link href="/landlord/maintenance" className="text-muted-foreground text-sm underline">
        Back to maintenance
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={request.title}
          description={`${request.leases.units.label} at ${request.leases.units.properties.name}, ${request.leases.units.properties.address_line}, ${request.leases.units.properties.city}`}
        />
        <MaintenanceStatusBadge status={request.status} />
      </div>

      <section className="space-y-3">
        <h2 className="section-title">What was reported</h2>
        <p className="bg-card rounded-md border px-4 py-3 text-sm whitespace-pre-line">
          {request.description}
        </p>
        <dl className="bg-card divide-y rounded-md border text-sm">
          <DetailRow
            label="Reported by"
            value={request.submitted_by_profile?.full_name ?? "The tenant"}
          />
          <DetailRow label="Reported on" value={request.created_at.slice(0, 10)} />
          <DetailRow label="Urgency" value={URGENCY_WORDS[request.urgency] ?? request.urgency} />
          <DetailRow
            label="Resolved on"
            value={request.resolved_at === null ? "Not yet" : request.resolved_at.slice(0, 10)}
          />
          <DetailRow
            label="Tenant confirmed"
            value={
              request.tenant_confirmed_at === null
                ? "Not confirmed"
                : `Confirmed on ${request.tenant_confirmed_at.slice(0, 10)}`
            }
          />
          <DetailRow
            label="Tenancy"
            value="Open the lease"
            href={`/landlord/leases/${request.lease_id}`}
          />
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Move it along</h2>
        <MaintenanceStatusControl requestId={request.id} currentStatus={request.status} />
      </section>
    </div>
  );
}
