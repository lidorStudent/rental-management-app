import Link from "next/link";

import { PropertyForm } from "@/components/properties/PropertyForm";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata = { title: "Add a property" };

export default function NewPropertyPage() {
  return (
    <div className="max-w-xl space-y-6">
      <Link href="/landlord/properties" className="text-sm text-muted-foreground underline">
        Back to properties
      </Link>
      <PageHeader
        title="Add a property"
        description="A building. The units inside it come next, and a house is a property with one unit."
      />
      <PropertyForm mode="create" />
    </div>
  );
}
