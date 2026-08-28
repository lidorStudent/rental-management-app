-- truncate goes too, and the guarantee becomes testable.
--
-- The previous migration took insert, update and delete from anon. It left truncate, on the
-- reasoning that PostgREST exposes no verb that reaches it. That reasoning was thin. truncate is the
-- one write privilege Row Level Security does not filter at all: a policy restricts which rows a
-- statement sees, and truncate does not look at rows. So of everything anon held, it was the single
-- grant with no backstop underneath it, which makes it the last one that should have been left.
--
-- The second half of this migration is a view, and it exists because the guarantee could not
-- otherwise be tested. PERM-36 asserts the other three by attempting them: the client sends an
-- insert, an update and a delete, and reads the refusal. There is no such attempt for truncate,
-- because PostgREST has no way to express one, and the catalogue that would answer the question
-- directly is not in the exposed schemas - `information_schema` and `pg_catalog` both come back as
-- PGRST205 for the service role as well as for anon.
--
-- So the alternative to this view was a security control with no test behind it, which is the kind
-- of control that quietly stops being true. It is deliberately the smallest thing that answers the
-- question: four booleans per table, no rows of anybody's data, and select granted to service_role
-- alone. anon and authenticated cannot read it, so it adds nothing to what either of them can do,
-- and the key that can read it is the one that already bypasses every policy in the database.

set search_path = public;

revoke truncate on all tables in schema public from anon;

alter default privileges for role postgres in schema public
  revoke truncate on tables from anon;

create view public.anon_write_privileges
with (security_invoker = on) as
select
  c.relname::text as table_name,
  has_table_privilege('anon', c.oid, 'INSERT') as may_insert,
  has_table_privilege('anon', c.oid, 'UPDATE') as may_update,
  has_table_privilege('anon', c.oid, 'DELETE') as may_delete,
  has_table_privilege('anon', c.oid, 'TRUNCATE') as may_truncate
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'v')
  and c.relname <> 'anon_write_privileges';

revoke all on public.anon_write_privileges from anon;
revoke all on public.anon_write_privileges from authenticated;
grant select on public.anon_write_privileges to service_role;
