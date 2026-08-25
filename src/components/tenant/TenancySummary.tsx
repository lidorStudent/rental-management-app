import { EmptyState } from "@/components/shared/EmptyState";
import { currentIsoDateInUtc } from "@/lib/dates/currentDate";
import { describeLeaseLifecycle } from "@/lib/leases/describeLeaseLifecycle";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

/**
 * The tenant's own tenancy: which flat, whose building, and the dates it runs for.
 *
 * Row Level Security limits this query to the tenant's own leases, so there is no filter here that
 * could be forgotten. The rent status and the payment history arrive as further sections on this
 * page, each behind its own Suspense boundary.
 */
export async function TenancySummary() {
  const supabaseClient = await createSupabaseServerClient();

  const { data: leases } = await supabaseClient
    .from("leases")
    .select("id, start_date, end_date, rent_due_day, units(label, properties(address_line, city))")
    .order("start_date", { ascending: false })
    .limit(1);

  const currentLease = leases?.[0];

  if (currentLease === undefined) {
    return (
      <EmptyState
        title="No tenancy recorded yet"
        description="Your landlord adds your tenancy here when your lease begins. Nothing is missing on your side."
      />
    );
  }

  const lifecycle = describeLeaseLifecycle({
    startDate: currentLease.start_date,
    endDate: currentLease.end_date,
    currentDate: currentIsoDateInUtc(),
  });

  const home = `${currentLease.units.label}, ${currentLease.units.properties.address_line}, ${currentLease.units.properties.city}`;

  return (
    <dl className="divide-y rounded-md border text-sm">
      <Row label="Home" value={home} />
      <Row label="Tenancy" value={`${currentLease.start_date} to ${currentLease.end_date}`} />
      <Row label="Rent due" value={`Day ${currentLease.rent_due_day} of each month`} />
      <Row label="Status" value={LIFECYCLE_WORDS[lifecycle]} />
    </dl>
  );
}

const LIFECYCLE_WORDS = {
  upcoming: "Starts in the future",
  active: "Running",
  ended: "Ended",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
