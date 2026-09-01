import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { currentIsoDateInUtc } from "@/lib/dates/currentDate";
import { describeUnitOccupancy, occupancyWords } from "@/lib/leases/describeUnitOccupancy";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

/**
 * One building and the units inside it.
 *
 * The units are listed as a plain table rather than the paginated one: a building has as many units
 * as it has, and that number does not grow with time the way a rent ledger does.
 *
 * A unit's occupancy is read off its leases every time this page renders. Nothing stores whether a
 * unit is let, so nothing can disagree with the tenancies that decide it.
 */
export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const supabaseClient = await createSupabaseServerClient();

  const { data: property } = await supabaseClient
    .from("properties")
    .select(
      "id, name, address_line, city, postal_code, units(id, label, bedroom_count, leases(id, start_date, end_date, tenant:profiles!leases_tenant_profile_id_fkey(full_name)))",
    )
    .eq("id", propertyId)
    .maybeSingle();

  // A property belonging to another landlord returns no rows, exactly like one that does not exist,
  // and both are answered with the same page.
  if (property === null) {
    notFound();
  }

  const today = currentIsoDateInUtc();
  const units = [...property.units].sort((first, second) =>
    first.label.localeCompare(second.label),
  );

  return (
    <div className="space-y-6">
      <Link href="/landlord/properties" className="text-sm text-muted-foreground underline">
        Back to properties
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={property.name}
          description={[property.address_line, property.city, property.postal_code]
            .filter((part) => part !== null && part !== "")
            .join(", ")}
        />
        <div className="flex gap-2">
          <Link
            href={`/landlord/properties/${property.id}/units/new`}
            className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
          >
            Add a unit
          </Link>
          <Link
            href={`/landlord/properties/${property.id}/edit`}
            className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
          >
            Edit property
          </Link>
        </div>
      </div>

      {units.length === 0 ? (
        <EmptyState
          title="No units yet"
          description="Add the flats, floors or rooms you let separately. A house that is let as one home is a single unit."
          action={{
            label: "Add a unit",
            href: `/landlord/properties/${property.id}/units/new`,
          }}
        />
      ) : (
        <div className="bg-card overflow-x-auto rounded-md border">
          <Table>
            <caption className="sr-only">Units in {property.name}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Bedrooms</TableHead>
                <TableHead>Currently</TableHead>
                <TableHead className="text-right">Tenancies</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => {
                const occupancy = describeUnitOccupancy(
                  unit.leases.map((lease) => ({
                    startDate: lease.start_date,
                    endDate: lease.end_date,
                    tenantName: lease.tenant?.full_name ?? null,
                  })),
                  today,
                );

                return (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {unit.bedroom_count ?? ""}
                    </TableCell>
                    <TableCell>{occupancyWords(occupancy)}</TableCell>
                    <TableCell className="text-right tabular-nums">{unit.leases.length}</TableCell>
                    <TableCell className="text-right">
                      {/*
                       * A unit with nobody in it is the third step of a landlord's first hour, and
                       * until now the only way on from here was to know that Leases is where a
                       * tenancy is recorded. Offered only when the unit is vacant: a unit that is
                       * occupied, or already reserved by an upcoming tenancy, would have the
                       * tenancy refused by the overlap rule, and offering an action that is going
                       * to be refused is worse than not offering it.
                       */}
                      {occupancy.state === "vacant" ? (
                        <Link
                          href={`/landlord/leases/new?unitId=${unit.id}`}
                          aria-label={`Record a tenancy on ${unit.label}`}
                          className="mr-3 text-sm underline"
                        >
                          Record a tenancy
                        </Link>
                      ) : null}
                      <Link
                        href={`/landlord/units/${unit.id}/edit`}
                        aria-label={`Edit ${unit.label}`}
                        className="text-sm underline"
                      >
                        Edit
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
