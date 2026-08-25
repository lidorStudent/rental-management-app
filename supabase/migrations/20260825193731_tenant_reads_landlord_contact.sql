-- A tenant may read the name and email address of their own landlord.
--
-- The landlord has been able to read their tenant's profile since the first policy migration,
-- because a lease with an unnamed tenant is useless. The other direction was missing, and a tenant
-- who cannot contact their landlord cannot report anything the product does not cover: a lost key,
-- a notice period, a question about the rent.
--
-- It is deliberately narrow. It answers for exactly one profile, the landlord named on a lease this
-- tenant is the tenant of, and for nobody else.

set search_path = public;

create policy profiles_select_landlord_of_own_lease
on public.profiles for select to authenticated
using (
  exists (
    select 1
    from public.leases
    where leases.landlord_id = profiles.id
      and leases.tenant_profile_id = (select auth.uid())
  )
);
