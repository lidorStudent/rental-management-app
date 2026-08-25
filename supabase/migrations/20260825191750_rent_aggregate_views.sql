-- Two aggregate views, so that no screen has to read a rent ledger row by row to add it up.
--
-- The rent overview shows every tenancy a landlord has, with what has been received against each.
-- Reading the payments themselves to total them would mean pulling three years of rows to display
-- one number per tenancy, and it would get slower every month the product is used. Postgres already
-- knows how to add, so it adds.
--
-- Both views are security_invoker, which means they run with the privileges and the Row Level
-- Security of whoever selects from them rather than of the role that created them. Without that a
-- view would be a hole straight through the policies underneath it.

set search_path = public;

-- One row per tenancy: everything the rent overview lists, with the ledger already summed.
create view public.lease_rent_summary
with (security_invoker = on)
as
select
  leases.id as lease_id,
  leases.landlord_id,
  leases.tenant_profile_id,
  leases.unit_id,
  leases.start_date,
  leases.end_date,
  leases.rent_amount_cents,
  leases.rent_due_day,
  units.label as unit_label,
  units.property_id,
  properties.name as property_name,
  tenant.full_name as tenant_full_name,
  coalesce(ledger.total_paid_cents, 0)::bigint as total_paid_cents,
  coalesce(ledger.payment_count, 0)::bigint as payment_count,
  ledger.last_received_on
from public.leases
join public.units on units.id = leases.unit_id
join public.properties on properties.id = units.property_id
left join public.profiles as tenant on tenant.id = leases.tenant_profile_id
left join (
  select
    lease_id,
    sum(amount_cents) as total_paid_cents,
    count(*) as payment_count,
    max(received_on) as last_received_on
  from public.rent_payments
  group by lease_id
) as ledger on ledger.lease_id = leases.id;

-- One row per rent period that has had anything paid against it. The schedule itself is not stored:
-- it is a function of the lease, worked out in the application, and this view only says how much has
-- arrived for each month. That is what lets a lease page show a status per period without reading
-- every payment behind it.
create view public.lease_period_totals
with (security_invoker = on)
as
select
  lease_id,
  period_month,
  sum(amount_cents)::bigint as paid_cents,
  count(*)::bigint as payment_count
from public.rent_payments
group by lease_id, period_month;

grant select on public.lease_rent_summary to authenticated;
grant select on public.lease_period_totals to authenticated;
