import Link from "next/link";

import { LeaseForm, type UnitChoice } from "@/components/leases/LeaseForm";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { currentIsoDateInUtc } from "@/lib/dates/currentDate";
import { describeUnitOccupancy, occupancyWords } from "@/lib/leases/describeUnitOccupancy";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const metadata = { title: "Record a tenancy" };

/**
 * The units and their current occupancy are read here, on the server, and handed to the form as
 * props. Choosing a unit in the form fetches nothing; it already knows.
 */
export default async function NewLeasePage({
  searchParams,
}: {
  searchParams: Promise<{ unitId?: string }>;
}) {
  const { unitId } = await searchParams;
  const supabaseClient = await createSupabaseServerClient();

  const { data: units } = await supabaseClient
    .from("units")
    .select(
      "id, label, properties(name), leases(start_date, end_date, tenant:profiles!leases_tenant_profile_id_fkey(full_name))",
    )
    .order("label", { ascending: true });

  const today = currentIsoDateInUtc();
  const unitChoices: UnitChoice[] = (units ?? []).map((unit) => ({
    unitId: unit.id,
    label: unit.label,
    propertyName: unit.properties.name,
    occupancy: occupancyWords(
      describeUnitOccupancy(
        unit.leases.map((lease) => ({
          startDate: lease.start_date,
          endDate: lease.end_date,
          tenantName: lease.tenant?.full_name ?? null,
        })),
        today,
      ),
    ),
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/landlord/leases" className="text-muted-foreground text-sm underline">
        Back to leases
      </Link>
      <PageHeader
        title="Record a tenancy"
        description="What was agreed: which unit, for how long, and at what rent."
      />

      {unitChoices.length === 0 ? (
        <EmptyState
          title="No units to let"
          description="A tenancy is recorded against a unit, so add a property and its units first."
          action={{ label: "Add a property", href: "/landlord/properties/new" }}
        />
      ) : (
        <LeaseForm units={unitChoices} preselectedUnitId={unitId} />
      )}
    </div>
  );
}
