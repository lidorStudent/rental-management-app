# Database

The database is Supabase Postgres. Everything about its shape lives in `migrations/`, which is the
only place the schema is defined. Nothing is changed by hand in the Supabase dashboard, because a
change made there exists in one project and in no file.

## The two projects

| Project | Reference | Used for |
| --- | --- | --- |
| `rental-management-app` | `jarkqjrfuzvvrbietxve` | The deployed application and local development |
| `rental-management-app-test` | `attddpdrjaftdbgzlzmv` | Automated tests only |

Both live in region `eu-central-1` and carry the same schema. They exist separately because the
authorisation tests sign real users in and write real rows, and those must never land in the data
the deployed application serves.

## Applying migrations

The CLI applies migrations to whichever project is currently linked, so the sequence is always
link, then push.

```sh
# Test project
supabase link --project-ref attddpdrjaftdbgzlzmv
supabase db push --linked

# Production project
supabase link --project-ref jarkqjrfuzvvrbietxve
supabase db push --linked
```

`supabase link` asks for the database password, which is the one recorded outside this repository
when the projects were created. `supabase db push` applies every migration file the target project
has not seen yet, in filename order, and records it in `supabase_migrations.schema_migrations`.

Apply to the test project first. A migration that fails there has cost nothing.

## Adding a migration

```sh
supabase migration new <short_name>
```

That creates `migrations/<utc timestamp>_<short_name>.sql`. The timestamp is what orders the file,
so never rename or edit a migration that has already been pushed; correct it with a new one
instead. Both projects must always be pushed to, or they drift.

## Checking what a project actually has

```sh
supabase db query --linked "select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename"
supabase db query --linked "select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.leases'::regclass"
```

## What the first migration contains

`20260825122011_core_schema.sql` creates the six tables of the technical plan with their enum
types, foreign keys, check constraints, indexes, and triggers. Three parts of it are worth knowing
about before reading it:

- **`leases_no_overlap`** is an exclusion constraint over `unit_id` and the lease's date range. It
  is the database-level guarantee that one unit is never let twice over the same dates, and it
  needs the `btree_gist` extension to index `uuid` equality inside a GiST constraint.
- **`create_profile_on_auth_user_insert`** creates the `public.profiles` row whenever an account is
  created in `auth.users`, reading `role` and `full_name` from the signup metadata. An Auth user
  therefore cannot exist without a profile.
- **Row Level Security is enabled on all six tables with no policy attached**, which denies
  everything that is not the service role. The policies are the next migration.
