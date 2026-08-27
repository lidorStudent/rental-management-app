import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PaginatedTable, type TableColumn } from "@/components/shared/PaginatedTable";
import { currentIsoDateInUtc } from "@/lib/dates/currentDate";
import { describeUnitOccupancy } from "@/lib/leases/describeUnitOccupancy";
import { pageRange } from "@/lib/pagination/describePage";
import { isPageBeyondTheEnd } from "@/lib/pagination/isPageBeyondTheEnd";
import { parsePageNumber } from "@/lib/pagination/parsePageNumber";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const metadata = { title: "Properties" };

const PAGE_SIZE = 20;

type PropertyRow = {
  id: string;
  name: string;
  address_line: string;
  city: string;
  units: { id: string; leases: { start_date: string; end_date: string }[] }[];
};

/**
 * Every building the signed-in landlord owns. The query carries no owner filter because Row Level
 * Security applies one, and the counts are worked out from the leases rather than read from a column
 * that would have to be kept in step.
 */
export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParameter } = await searchParams;
  const page = parsePageNumber(pageParameter);
  const { startIndex, endIndex } = pageRange({ page, pageSize: PAGE_SIZE });

  const supabaseClient = await createSupabaseServerClient();
  const {
    data: properties,
    count,
    error,
  } = await supabaseClient
    .from("properties")
    .select("id, name, address_line, city, units(id, leases(start_date, end_date))", {
      count: "exact",
    })
    .order("name", { ascending: true })
    .range(startIndex, endIndex);

  if (isPageBeyondTheEnd(error)) {
    redirect("/landlord/properties");
  }

  const today = currentIsoDateInUtc();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Properties"
          description="The buildings you own and the units inside them."
        />
        <Link
          href="/landlord/properties/new"
          className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-9 items-center rounded-md border border-transparent px-4 text-sm font-medium"
        >
          Add a property
        </Link>
      </div>

      <PaginatedTable
        caption="Your properties"
        columns={buildColumns(today)}
        rows={properties ?? []}
        rowKey={(row) => row.id}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={count ?? 0}
        basePath="/landlord/properties"
        emptyState={
          <EmptyState
            title="No properties yet"
            description="Add the first building, then the units inside it. Tenancies and rent hang off a unit, so this is where everything starts."
            action={{ label: "Add a property", href: "/landlord/properties/new" }}
          />
        }
      />
    </div>
  );
}

function buildColumns(today: string): readonly TableColumn<PropertyRow>[] {
  return [
    {
      key: "name",
      header: "Property",
      cell: (row) => (
        <Link href={`/landlord/properties/${row.id}`} className="font-medium underline">
          {row.name}
        </Link>
      ),
    },
    { key: "address", header: "Address", cell: (row) => `${row.address_line}, ${row.city}` },
    { key: "units", header: "Units", alignment: "right", cell: (row) => row.units.length },
    {
      key: "occupied",
      header: "Let",
      alignment: "right",
      cell: (row) => `${countOccupiedUnits(row, today)} of ${row.units.length}`,
    },
  ];
}

function countOccupiedUnits(property: PropertyRow, today: string): number {
  return property.units.filter(
    (unit) =>
      describeUnitOccupancy(
        unit.leases.map((lease) => ({
          startDate: lease.start_date,
          endDate: lease.end_date,
          tenantName: null,
        })),
        today,
      ).state === "occupied",
  ).length;
}
