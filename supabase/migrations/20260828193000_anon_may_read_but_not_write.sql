-- The anonymous role may read. It may no longer write.
--
-- Supabase grants anon and authenticated every privilege on everything in the public schema, and
-- Row Level Security is what makes that safe. It does make it safe: an anonymous client was pointed
-- at all six tables and all three views and got nothing back, and every write it attempted was
-- refused. But it was safe on one mechanism. A table shipped one day without a policy, or with a
-- policy that turned out to be broader than intended, would have been world-writable the moment it
-- was created, and nothing else in the system would have objected.
--
-- Nothing in this product writes as anon. Every write lives in src/actions, all seventeen of them,
-- and each one resolves the acting user before it touches a table: fifteen through the client that
-- carries the session, so the request arrives as `authenticated`, and two through the service role.
-- Registration is the one flow that happens with no session and still causes a row to appear in
-- profiles, and that row is inserted by create_profile_for_new_auth_user, a security definer trigger
-- on auth.users that runs as its owner rather than as the caller. So this revoke removes a
-- capability that no code path uses.
--
-- SELECT is deliberately left in place. /api/health reads a count of properties with no session, on
-- purpose: a scheduler calls it to keep a free-plan project from being paused, and it has to make a
-- real round trip to prove Postgres is awake. Row Level Security answers that read with nothing,
-- which is why the count is always zero and the endpoint discloses nothing. Revoking select would
-- turn that check into an error and buy nothing, because the policies already return no rows.
--
-- The default privileges are revoked as well as the current ones. Without that, the next table added
-- to this schema would arrive with the same full grant and the fix would last exactly as long as the
-- schema stands still. Only the defaults granted by `postgres` can be changed from here; any that
-- supabase_admin owns are outside what this connection may alter, and are recorded in
-- docs/05-security.md rather than left as a surprise.
--
-- The authenticated role keeps its write grants, and that is not an oversight. Every legitimate
-- write in this product is made by a signed-in user through the client that carries their session,
-- so the request arrives as `authenticated`. Revoking those grants would not be defence in depth; it
-- would remove the only path the application has, and Row Level Security is what scopes those writes
-- to the writer's own rows.

set search_path = public;

revoke insert, update, delete on all tables in schema public from anon;

alter default privileges for role postgres in schema public
  revoke insert, update, delete on tables from anon;
