import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { UnitForm } from "@/components/units/UnitForm";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const metadata = { title: "Add a unit" };

export default async function NewUnitPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const supabaseClient = await createSupabaseServerClient();

  // Reading the property first both gives the heading its name and proves the building is this
  // landlord's before a form is shown for it.
  const { data: property } = await supabaseClient
    .from("properties")
    .select("id, name")
    .eq("id", propertyId)
    .maybeSingle();

  if (property === null) {
    notFound();
  }

  return (
    <div className="max-w-xl space-y-6">
      <Link
        href={`/landlord/properties/${property.id}`}
        className="text-muted-foreground text-sm underline"
      >
        Back to {property.name}
      </Link>
      <PageHeader
        title="Add a unit"
        description={`A separately let part of ${property.name}. Rent and tenancies hang off a unit.`}
      />
      <UnitForm mode="create" propertyId={property.id} />
    </div>
  );
}
