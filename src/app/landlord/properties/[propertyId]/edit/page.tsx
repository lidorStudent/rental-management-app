import Link from "next/link";
import { notFound } from "next/navigation";

import { DeletePropertyButton } from "@/components/properties/DeletePropertyButton";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const metadata = { title: "Edit property" };

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const supabaseClient = await createSupabaseServerClient();

  const { data: property } = await supabaseClient
    .from("properties")
    .select("id, name, address_line, city, postal_code, units(id)")
    .eq("id", propertyId)
    .maybeSingle();

  if (property === null) {
    notFound();
  }

  return (
    <div className="max-w-xl space-y-8">
      <Link
        href={`/landlord/properties/${property.id}`}
        className="text-muted-foreground text-sm underline"
      >
        Back to {property.name}
      </Link>

      <div className="space-y-6">
        <PageHeader title="Edit property" description="Correcting the record of the building." />
        <PropertyForm
          mode="edit"
          propertyId={property.id}
          initialValues={{
            name: property.name,
            addressLine: property.address_line,
            city: property.city,
            postalCode: property.postal_code ?? "",
          }}
        />
      </div>

      <section className="space-y-3 border-t pt-6">
        <h2 className="section-title">Delete</h2>
        <DeletePropertyButton propertyId={property.id} unitCount={property.units.length} />
      </section>
    </div>
  );
}
