-- Row Level Security policies for all six tables.
--
-- This file is the authorisation boundary of the product. The application re-checks ownership
-- before every write and hides controls a user may not use, but neither of those is trusted: if
-- both were deleted, no user could still reach another user's rows, because the database itself
-- decides which rows exist for the current session.
--
-- Every policy derives the acting user from auth.uid(). No policy reads an identifier that arrived
-- from the client, and no policy is written FOR ALL: select, insert, update and delete are stated
-- separately so that each one can be read as a single sentence.
--
-- Where an operation has no policy, that silence is the denial. RLS refuses anything no policy
-- allows, so the absence of, for example, a tenant update policy on rent_payments is what makes
-- the ledger landlord-only.
--
-- The five domain invariants, and what enforces each:
--   1. A unit never has two overlapping active leases.
--      Not a policy. The leases_no_overlap exclusion constraint in the core schema migration; RLS
--      cannot compare a row against other rows it is not being asked about.
--   2. Rent status is always derived, never typed in.
--      Not a policy. There is no status column on any table to write to.
--   3. A tenant can only read or write rows belonging to their own lease.
--      The *_select_as_tenant policies below, all of which resolve the lease from auth.uid(), and
--      maintenance_requests_insert_as_tenant, which is the only write a tenant has anywhere.
--   4. A landlord can only read or write rows they own.
--      The *_own policies below. Every one requires landlord_id = auth.uid(), and every insert and
--      update additionally requires that the parent row is also theirs.
--   5. Rent is a ledger of payments the landlord records as received.
--      The absence of any tenant insert, update or delete policy on rent_payments.

set search_path = public;

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------
-- All of these are SECURITY DEFINER so that a policy never depends on another table's policies
-- being correct, and so that a policy on profiles that reads profiles cannot recurse. Each one is
-- scoped to auth.uid() internally, so running as the owner grants the caller nothing extra.

create function public.current_profile_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create function public.is_current_tenant_lease(target_lease_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.leases
    where leases.id = target_lease_id
      and leases.tenant_profile_id = (select auth.uid())
  );
$$;

create function public.is_current_tenant_active_lease(target_lease_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.leases
    where leases.id = target_lease_id
      and leases.tenant_profile_id = (select auth.uid())
      and current_date between leases.start_date and leases.end_date
  );
$$;

create function public.is_current_tenant_unit(target_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.leases
    where leases.unit_id = target_unit_id
      and leases.tenant_profile_id = (select auth.uid())
  );
$$;

create function public.is_current_tenant_property(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.leases
    join public.units on units.id = leases.unit_id
    where units.property_id = target_property_id
      and leases.tenant_profile_id = (select auth.uid())
  );
$$;

-- Answers only for a lease the caller is the tenant of, so it cannot be used to discover who owns
-- an arbitrary lease id.
create function public.landlord_of_current_tenant_lease(target_lease_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select leases.landlord_id
  from public.leases
  where leases.id = target_lease_id
    and leases.tenant_profile_id = (select auth.uid());
$$;

revoke execute on function public.current_profile_role() from public;
revoke execute on function public.is_current_tenant_lease(uuid) from public;
revoke execute on function public.is_current_tenant_active_lease(uuid) from public;
revoke execute on function public.is_current_tenant_unit(uuid) from public;
revoke execute on function public.is_current_tenant_property(uuid) from public;
revoke execute on function public.landlord_of_current_tenant_lease(uuid) from public;

grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_current_tenant_lease(uuid) to authenticated;
grant execute on function public.is_current_tenant_active_lease(uuid) to authenticated;
grant execute on function public.is_current_tenant_unit(uuid) to authenticated;
grant execute on function public.is_current_tenant_property(uuid) to authenticated;
grant execute on function public.landlord_of_current_tenant_lease(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------------------------

-- Prevents one user reading another user's name and email address by requesting a profile id they
-- happen to have seen.
create policy profiles_select_own
on public.profiles for select to authenticated
using (id = (select auth.uid()));

-- Prevents a landlord from being unable to display their own tenant's name, without opening the
-- table: only a profile that is the tenant on one of this landlord's leases is readable.
create policy profiles_select_tenant_of_own_lease
on public.profiles for select to authenticated
using (
  exists (
    select 1
    from public.leases
    where leases.tenant_profile_id = profiles.id
      and leases.landlord_id = (select auth.uid())
  )
);

-- Prevents a user editing somebody else's profile. The WITH CHECK repeats the condition so that a
-- row cannot be updated into belonging to another account.
create policy profiles_update_own
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- No insert policy: prevents anyone forging a profile row. Profiles are created only by the
-- create_profile_for_new_auth_user trigger when an Auth account is created.
-- No delete policy: prevents a user erasing the account a lease and its ledger point at.

-- Prevents a tenant promoting themselves to landlord by updating their own role, which
-- profiles_update_own would otherwise permit because the row is genuinely theirs.
create function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'The role of a profile cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_role_is_immutable
before update on public.profiles
for each row execute function public.prevent_profile_role_change();

-- ---------------------------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------------------------

-- Prevents a landlord listing another landlord's portfolio.
create policy properties_select_own
on public.properties for select to authenticated
using (landlord_id = (select auth.uid()) and public.current_profile_role() = 'landlord');

-- Prevents a landlord creating a property owned by someone else, which would otherwise let them
-- plant a row inside another landlord's portfolio. The role test also stops a tenant account from
-- writing here at all.
create policy properties_insert_own
on public.properties for insert to authenticated
with check (landlord_id = (select auth.uid()) and public.current_profile_role() = 'landlord');

-- Prevents editing another landlord's property, and prevents handing a property away by changing
-- its owner during the update.
create policy properties_update_own
on public.properties for update to authenticated
using (landlord_id = (select auth.uid()) and public.current_profile_role() = 'landlord')
with check (landlord_id = (select auth.uid()));

-- Prevents deleting another landlord's property.
create policy properties_delete_own
on public.properties for delete to authenticated
using (landlord_id = (select auth.uid()) and public.current_profile_role() = 'landlord');

-- Prevents a tenant seeing the rest of their landlord's portfolio while still letting them see the
-- address of the building they live in.
create policy properties_select_as_tenant
on public.properties for select to authenticated
using (public.is_current_tenant_property(id));

-- ---------------------------------------------------------------------------------------------
-- units
-- ---------------------------------------------------------------------------------------------

-- Prevents a landlord reading units that belong to another landlord.
create policy units_select_own
on public.units for select to authenticated
using (landlord_id = (select auth.uid()) and public.current_profile_role() = 'landlord');

-- Prevents attaching a unit to a property owned by someone else, which is the obvious way to get a
-- row into another landlord's portfolio while still passing an ownership check on the unit itself.
create policy units_insert_own
on public.units for insert to authenticated
with check (
  landlord_id = (select auth.uid())
  and public.current_profile_role() = 'landlord'
  and exists (
    select 1 from public.properties
    where properties.id = units.property_id
      and properties.landlord_id = (select auth.uid())
  )
);

-- Prevents editing another landlord's unit, and prevents moving a unit into a property that is not
-- theirs during the update.
create policy units_update_own
on public.units for update to authenticated
using (landlord_id = (select auth.uid()) and public.current_profile_role() = 'landlord')
with check (
  landlord_id = (select auth.uid())
  and exists (
    select 1 from public.properties
    where properties.id = units.property_id
      and properties.landlord_id = (select auth.uid())
  )
);

-- Prevents deleting another landlord's unit.
create policy units_delete_own
on public.units for delete to authenticated
using (landlord_id = (select auth.uid()) and public.current_profile_role() = 'landlord');

-- Prevents a tenant enumerating the other flats in their building, while still letting them see
-- the one they rent.
create policy units_select_as_tenant
on public.units for select to authenticated
using (public.is_current_tenant_unit(id));

-- ---------------------------------------------------------------------------------------------
-- leases
-- ---------------------------------------------------------------------------------------------

-- Prevents a landlord reading the tenancies of another landlord.
create policy leases_select_own
on public.leases for select to authenticated
using (landlord_id = (select auth.uid()) and public.current_profile_role() = 'landlord');

-- Prevents letting out a unit that belongs to another landlord, and prevents a tenant account
-- creating a tenancy for itself.
create policy leases_insert_own
on public.leases for insert to authenticated
with check (
  landlord_id = (select auth.uid())
  and public.current_profile_role() = 'landlord'
  and exists (
    select 1 from public.units
    where units.id = leases.unit_id
      and units.landlord_id = (select auth.uid())
  )
);

-- Prevents editing another landlord's lease, and prevents moving a lease onto a unit that is not
-- theirs, which would move a rent ledger into another portfolio.
create policy leases_update_own
on public.leases for update to authenticated
using (landlord_id = (select auth.uid()) and public.current_profile_role() = 'landlord')
with check (
  landlord_id = (select auth.uid())
  and exists (
    select 1 from public.units
    where units.id = leases.unit_id
      and units.landlord_id = (select auth.uid())
  )
);

-- Prevents deleting another landlord's lease.
create policy leases_delete_own
on public.leases for delete to authenticated
using (landlord_id = (select auth.uid()) and public.current_profile_role() = 'landlord');

-- Prevents a tenant reading any tenancy other than their own, including earlier tenancies of the
-- flat they live in. A lease that has ended stays readable, because the tenant's own history is
-- theirs.
create policy leases_select_as_tenant
on public.leases for select to authenticated
using (tenant_profile_id = (select auth.uid()));

-- No tenant insert, update or delete policy: prevents a tenant creating a tenancy, extending their
-- own end date, changing their own rent, or removing a lease they dislike.

-- ---------------------------------------------------------------------------------------------
-- rent_payments
-- ---------------------------------------------------------------------------------------------

-- Prevents a landlord reading another landlord's ledger, which is the whole of their income.
create policy rent_payments_select_own
on public.rent_payments for select to authenticated
using (landlord_id = (select auth.uid()) and public.current_profile_role() = 'landlord');

-- Prevents recording a payment against another landlord's lease, and prevents attributing the
-- entry to somebody else by supplying a different recorded_by.
create policy rent_payments_insert_own
on public.rent_payments for insert to authenticated
with check (
  landlord_id = (select auth.uid())
  and recorded_by = (select auth.uid())
  and public.current_profile_role() = 'landlord'
  and exists (
    select 1 from public.leases
    where leases.id = rent_payments.lease_id
      and leases.landlord_id = (select auth.uid())
  )
);

-- Prevents correcting another landlord's ledger entry, and prevents moving an entry onto a lease
-- that is not theirs.
create policy rent_payments_update_own
on public.rent_payments for update to authenticated
using (landlord_id = (select auth.uid()) and public.current_profile_role() = 'landlord')
with check (
  landlord_id = (select auth.uid())
  and exists (
    select 1 from public.leases
    where leases.id = rent_payments.lease_id
      and leases.landlord_id = (select auth.uid())
  )
);

-- Prevents deleting another landlord's ledger entry.
create policy rent_payments_delete_own
on public.rent_payments for delete to authenticated
using (landlord_id = (select auth.uid()) and public.current_profile_role() = 'landlord');

-- Prevents a tenant reading what anybody else has paid, while letting them prove what they paid.
create policy rent_payments_select_as_tenant
on public.rent_payments for select to authenticated
using (public.is_current_tenant_lease(lease_id));

-- No tenant insert, update or delete policy: this is domain invariant 5. The ledger records money
-- the landlord says arrived, so a tenant cannot declare their own rent paid, edit an amount, or
-- delete an entry that shows them in arrears.

-- ---------------------------------------------------------------------------------------------
-- maintenance_requests
-- ---------------------------------------------------------------------------------------------

-- Prevents a landlord reading problems reported against another landlord's flats.
create policy maintenance_requests_select_own
on public.maintenance_requests for select to authenticated
using (landlord_id = (select auth.uid()) and public.current_profile_role() = 'landlord');

-- Prevents a landlord changing the status of a request that is not theirs, and prevents moving a
-- request onto another lease.
create policy maintenance_requests_update_own
on public.maintenance_requests for update to authenticated
using (landlord_id = (select auth.uid()) and public.current_profile_role() = 'landlord')
with check (
  landlord_id = (select auth.uid())
  and exists (
    select 1 from public.leases
    where leases.id = maintenance_requests.lease_id
      and leases.landlord_id = (select auth.uid())
  )
);

-- Prevents a tenant reading what other tenants have reported, including earlier reports against
-- the flat they now live in.
create policy maintenance_requests_select_as_tenant
on public.maintenance_requests for select to authenticated
using (public.is_current_tenant_lease(lease_id));

-- Prevents a tenant reporting a problem against somebody else's flat, against a tenancy that has
-- ended or has not started, in another tenant's name, or already marked resolved. The landlord_id
-- is not taken from the request either: it must match the landlord the lease actually belongs to.
create policy maintenance_requests_insert_as_tenant
on public.maintenance_requests for insert to authenticated
with check (
  public.current_profile_role() = 'tenant'
  and submitted_by = (select auth.uid())
  and public.is_current_tenant_active_lease(lease_id)
  and landlord_id = public.landlord_of_current_tenant_lease(lease_id)
  and status = 'submitted'
  and resolved_at is null
);

-- No landlord insert policy: a maintenance request is a tenant's report, and a landlord writing
-- one would be putting words in their tenant's mouth in a record both parties can read.
-- No delete policy for anyone: prevents either party erasing a reported problem. Closing one is a
-- status, not a deletion.
