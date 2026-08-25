import { EmptyState } from "@/components/shared/EmptyState";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

/**
 * A first look at the portfolio: how much of it there is, and how much of it is currently let.
 *
 * An async server component behind its own Suspense boundary. It reads its own data, so the page
 * around it renders immediately and only this panel is a skeleton while the counts arrive. Every
 * count is scoped by Row Level Security to the signed-in landlord without a single filter being
 * written here.
 */
export async function PortfolioSummary() {
  const supabaseClient = await createSupabaseServerClient();

  const [properties, units, leases, openRequests] = await Promise.all([
    supabaseClient.from("properties").select("id", { count: "exact", head: true }),
    supabaseClient.from("units").select("id", { count: "exact", head: true }),
    supabaseClient.from("leases").select("id", { count: "exact", head: true }),
    supabaseClient
      .from("maintenance_requests")
      .select("id", { count: "exact", head: true })
      .neq("status", "resolved"),
  ]);

  if ((properties.count ?? 0) === 0) {
    return (
      <EmptyState
        title="No properties yet"
        description="Add the first building, then the units inside it. Tenancies and rent hang off a unit."
        action={{ label: "Add a property", href: "/landlord/properties/new" }}
      />
    );
  }

  return (
    <dl className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-4">
      <Figure label="Properties" value={properties.count} />
      <Figure label="Units" value={units.count} />
      <Figure label="Tenancies" value={leases.count} />
      <Figure label="Open problems" value={openRequests.count} />
    </dl>
  );
}

function Figure({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-background px-4 py-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-xl font-medium tabular-nums">{value ?? 0}</dd>
    </div>
  );
}
