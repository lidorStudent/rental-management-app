import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { DeleteUnitButton } from "@/components/units/DeleteUnitButton";
import { UnitForm } from "@/components/units/UnitForm";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const metadata = { title: "Edit unit" };

export default async function EditUnitPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  const supabaseClient = await createSupabaseServerClient();

  const { data: unit } = await supabaseClient
    .from("units")
    .select("id, label, bedroom_count, property_id, properties(name), leases(id)")
    .eq("id", unitId)
    .maybeSingle();

  if (unit === null) {
    notFound();
  }

  return (
    <div className="max-w-xl space-y-8">
      <Link
        href={`/landlord/properties/${unit.property_id}`}
        className="text-muted-foreground text-sm underline"
      >
        Back to {unit.properties.name}
      </Link>

      <div className="space-y-6">
        <PageHeader title={`Edit ${unit.label}`} description="Correcting the record of the unit." />
        <UnitForm
          mode="edit"
          unitId={unit.id}
          propertyId={unit.property_id}
          initialValues={{
            label: unit.label,
            bedroomCount: unit.bedroom_count ?? undefined,
          }}
        />
      </div>

      <section className="space-y-3 border-t pt-6">
        <h2 className="text-sm font-medium">Delete</h2>
        <DeleteUnitButton
          unitId={unit.id}
          propertyId={unit.property_id}
          leaseCount={unit.leases.length}
        />
      </section>
    </div>
  );
}
