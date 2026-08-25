import "server-only";

import { currentIsoDateInUtc } from "@/lib/dates/currentDate";
import {
  chooseCurrentLease,
  describeLeaseLifecycle,
  type LeaseLifecycle,
} from "@/lib/leases/describeLeaseLifecycle";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

/**
 * The tenancy this portal is about, resolved from the session and from nothing else.
 *
 * There is no lease id in any tenant URL, and this is why: the query carries no filter naming a
 * lease or a tenant, and Row Level Security returns only the leases where this signed-in user is
 * the tenant. A tenant with no tenancy at all gets null, which is a state the pages render rather
 * than an error.
 */
export type TenantLease = {
  id: string;
  startDate: string;
  endDate: string;
  rentAmountInAgorot: number;
  depositAmountInAgorot: number;
  rentDueDay: number;
  unitLabel: string;
  bedroomCount: number | null;
  propertyName: string;
  addressLine: string;
  city: string;
  postalCode: string | null;
  landlordName: string | null;
  landlordEmail: string | null;
  lifecycle: LeaseLifecycle;
};

export async function loadTenantLease(): Promise<TenantLease | null> {
  const supabaseClient = await createSupabaseServerClient();

  const { data: leases } = await supabaseClient
    .from("leases")
    .select(
      "id, start_date, end_date, rent_amount_cents, deposit_amount_cents, rent_due_day, units(label, bedroom_count, properties(name, address_line, city, postal_code)), landlord:profiles!leases_landlord_id_fkey(full_name, email)",
    )
    .order("start_date", { ascending: false });

  const today = currentIsoDateInUtc();
  const chosen = chooseCurrentLease(
    (leases ?? []).map((lease) => ({
      ...lease,
      startDate: lease.start_date,
      endDate: lease.end_date,
    })),
    today,
  );

  if (chosen === null) {
    return null;
  }

  return {
    id: chosen.id,
    startDate: chosen.start_date,
    endDate: chosen.end_date,
    rentAmountInAgorot: chosen.rent_amount_cents,
    depositAmountInAgorot: chosen.deposit_amount_cents,
    rentDueDay: chosen.rent_due_day,
    unitLabel: chosen.units.label,
    bedroomCount: chosen.units.bedroom_count,
    propertyName: chosen.units.properties.name,
    addressLine: chosen.units.properties.address_line,
    city: chosen.units.properties.city,
    postalCode: chosen.units.properties.postal_code,
    landlordName: chosen.landlord?.full_name ?? null,
    landlordEmail: chosen.landlord?.email ?? null,
    lifecycle: describeLeaseLifecycle({
      startDate: chosen.start_date,
      endDate: chosen.end_date,
      currentDate: today,
    }),
  };
}
