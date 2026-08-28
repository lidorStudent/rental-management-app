-- must_change_password and email are not the account's own to write.
--
-- profiles_update_own lets an account update its own row, which is right for a row that genuinely
-- belongs to it. It was two columns too broad.
--
-- must_change_password is the value the proxy reads to hold a tenant on /change-password until they
-- replace the temporary password their landlord issued. The flag lives on the tenant's own row, so
-- the tenant could clear it with a single request and walk into the portal with the landlord's
-- password still active. That made the forced change a suggestion rather than a gate.
--
-- email is what the landlord reads to contact their tenant. It is only a copy: the address that
-- actually signs in lives in auth.users and is not reachable from here. A tenant could rewrite the
-- copy and leave the landlord looking at an address that reaches nobody, while still signing in
-- with the real one.
--
-- full_name is deliberately left writable. Nothing in the interface offers editing it, so pinning
-- it would change no behaviour today, and a person's own name is theirs: refusing it would be a
-- functional restriction rather than a security fix. DB-24 asserts that choice so it reads as a
-- decision rather than an omission.
--
-- The service role passes straight through, the same way it does in
-- restrict_tenant_maintenance_update: it has no auth.uid(). That is the path
-- regenerateTenantPassword takes when a landlord issues a new temporary password and re-arms the
-- flag, the path changePassword takes to clear it once the password really has been replaced, and
-- the path the seed takes to build the demo accounts.

set search_path = public;

create function public.prevent_profile_self_service_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.must_change_password is distinct from old.must_change_password then
    raise exception 'must_change_password is not set by the account it belongs to.'
      using errcode = '42501';
  end if;

  if new.email is distinct from old.email then
    raise exception 'The email address on a profile is not changed here.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_self_service_columns_are_pinned
before update on public.profiles
for each row execute function public.prevent_profile_self_service_changes();
