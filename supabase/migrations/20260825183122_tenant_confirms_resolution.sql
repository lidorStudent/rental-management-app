-- A tenant confirms that a resolved request really was fixed.
--
-- Until now the maintenance flow ended at the landlord's word: they marked a request resolved and
-- that was the record. The tenant is the one standing in the flat, so their confirmation is the
-- fact worth recording, and a resolved request nobody confirmed is worth seeing on a dashboard.
--
-- This is the only write a tenant has anywhere in the product besides reporting a problem in the
-- first place. It is deliberately the narrowest write the database can express: one column, on one
-- row, in one status, once.

set search_path = public;

alter table public.maintenance_requests
  add column tenant_confirmed_at timestamptz;

-- A confirmation only means anything against a resolution. Any status change clears it, because a
-- request that was reopened is not a request the tenant agreed was finished.
alter table public.maintenance_requests
  add constraint maintenance_requests_confirmation_needs_resolution
  check (tenant_confirmed_at is null or status = 'resolved');

-- Prevents a tenant confirming somebody else's request, confirming one that is still open, or
-- confirming the same one twice. The USING clause decides which rows they may touch at all; the
-- WITH CHECK decides what the row is allowed to look like afterwards.
create policy maintenance_requests_confirm_as_tenant
on public.maintenance_requests for update to authenticated
using (
  public.is_current_tenant_lease(lease_id)
  and status = 'resolved'
  and tenant_confirmed_at is null
)
with check (
  public.is_current_tenant_lease(lease_id)
  and status = 'resolved'
  and tenant_confirmed_at is not null
);

-- A policy decides which rows an update may touch, never which columns, so the policy above would
-- also let a tenant rewrite the title of their own resolved request while confirming it. This is
-- the same problem profiles_role_is_immutable solves for a profile's role, and the same answer:
-- everything except the confirmation must come out of the update unchanged.
create function public.restrict_tenant_maintenance_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The landlord owns the row and moves it through its statuses. The service role, used by the
  -- seed, has no auth.uid() at all.
  if (select auth.uid()) is null or (select auth.uid()) = old.landlord_id then
    return new;
  end if;

  if row(
       new.id, new.lease_id, new.landlord_id, new.submitted_by, new.title, new.description,
       new.urgency, new.status, new.created_at, new.resolved_at
     ) is distinct from row(
       old.id, old.lease_id, old.landlord_id, old.submitted_by, old.title, old.description,
       old.urgency, old.status, old.created_at, old.resolved_at
     ) then
    raise exception 'A tenant may only confirm that a request was resolved.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger maintenance_requests_tenant_confirms_only
before update on public.maintenance_requests
for each row execute function public.restrict_tenant_maintenance_update();
