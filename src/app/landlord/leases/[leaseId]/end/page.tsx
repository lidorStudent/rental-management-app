import Link from "next/link";
import { notFound } from "next/navigation";

import { EndLeaseForm } from "@/components/leases/EndLeaseForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const metadata = { title: "End a tenancy" };

export default async function EndLeasePage({ params }: { params: Promise<{ leaseId: string }> }) {
  const { leaseId } = await params;
  const supabaseClient = await createSupabaseServerClient();

  const { data: lease } = await supabaseClient
    .from("leases")
    .select("id, start_date, end_date, units(label, properties(name))")
    .eq("id", leaseId)
    .maybeSingle();

  if (lease === null) {
    notFound();
  }

  return (
    <div className="max-w-xl space-y-6">
      <Link
        href={`/landlord/leases/${lease.id}`}
        className="text-muted-foreground text-sm underline"
      >
        Back to the tenancy
      </Link>
      <PageHeader
        title="End this tenancy early"
        description={`${lease.units.label} at ${lease.units.properties.name}, which began on ${lease.start_date}.`}
      />
      <EndLeaseForm leaseId={lease.id} currentEndDate={lease.end_date} />
    </div>
  );
}
