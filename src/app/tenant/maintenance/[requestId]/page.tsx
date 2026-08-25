import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmResolutionButton } from "@/components/maintenance/ConfirmResolutionButton";
import {
  MaintenanceStatusBadge,
  URGENCY_WORDS,
} from "@/components/maintenance/MaintenanceStatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

/**
 * One problem this tenant reported.
 *
 * This is the only tenant page with an identifier in its URL, so it is the only one where an
 * identifier has to be checked. The check is the query itself: it runs as the signed-in tenant, and
 * maintenance_requests_select_as_tenant returns rows only for a lease they are the tenant of. Another
 * tenant's request comes back as no rows and is answered with the same not-found page as a request
 * that never existed. Nothing here compares an id against the session by hand, because nothing here
 * could be trusted to remember to.
 */
export default async function TenantMaintenanceRequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const supabaseClient = await createSupabaseServerClient();

  const { data: request } = await supabaseClient
    .from("maintenance_requests")
    .select("id, title, description, urgency, status, created_at, resolved_at, tenant_confirmed_at")
    .eq("id", requestId)
    .maybeSingle();

  if (request === null) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link href="/tenant/maintenance" className="text-muted-foreground text-sm underline">
        Back to your problems
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title={request.title} />
        <MaintenanceStatusBadge status={request.status} />
      </div>

      <p className="rounded-md border px-4 py-3 text-sm whitespace-pre-line">
        {request.description}
      </p>

      <dl className="divide-y rounded-md border text-sm">
        <Row label="Reported on" value={request.created_at.slice(0, 10)} />
        <Row label="Urgency" value={URGENCY_WORDS[request.urgency] ?? request.urgency} />
        <Row label="Where it has got to" value={STATUS_EXPLANATIONS[request.status]} />
        <Row
          label="Resolved on"
          value={request.resolved_at === null ? "Not yet" : request.resolved_at.slice(0, 10)}
        />
      </dl>

      {request.status === "resolved" && request.tenant_confirmed_at === null ? (
        <ConfirmResolutionButton requestId={request.id} />
      ) : null}

      {request.tenant_confirmed_at === null ? null : (
        <p role="status" className="rounded-md border px-4 py-3 text-sm">
          You confirmed this was fixed on {request.tenant_confirmed_at.slice(0, 10)}.
        </p>
      )}
    </div>
  );
}

const STATUS_EXPLANATIONS: Record<string, string> = {
  submitted: "Reported. Your landlord has not marked it seen yet",
  acknowledged: "Your landlord has seen it",
  in_progress: "Being worked on",
  resolved: "Your landlord has marked it fixed",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
