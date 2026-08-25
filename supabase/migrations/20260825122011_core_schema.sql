-- Core schema for the rental management app.
--
-- Scope: the six tables of the technical plan, their constraints, their indexes, and the two
-- triggers that keep derived columns honest. Row Level Security is enabled here so that the tables
-- are closed by default, but no policy is created; the policies are the next migration.
--
-- Money is stored as an integer number of minor units (cents). Calendar facts are `date`, instants
-- are `timestamptz`, and every instant is stored in UTC.

create schema if not exists extensions;

-- Needed for the exclusion constraint on leases: gist cannot index a plain uuid for equality
-- without the operator classes this extension provides.
create extension if not exists btree_gist with schema extensions;

set search_path = public, extensions;

-- Enum types rather than text with a check constraint, so that an invalid value fails both at
-- insert time and at compile time in the generated TypeScript.
create type public.user_role as enum ('landlord', 'tenant');
create type public.payment_method as enum ('bank_transfer', 'cash', 'cheque', 'card', 'other');
create type public.maintenance_urgency as enum ('low', 'normal', 'urgent');
create type public.maintenance_status as enum ('submitted', 'acknowledged', 'in_progress', 'resolved');

-- Every table carries updated_at, and no application code is trusted to maintain it.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------------------------
-- One row per account. The primary key is the Auth user id, so auth.uid() compares directly in
-- every policy with no lookup.

create table public.profiles (
  -- Cascade: a profile is the application's half of an Auth user. If the account is gone, the
  -- profile describes nobody, and keeping it would leave rows owned by an identity that cannot
  -- sign in.
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  full_name text not null,
  email text not null,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (char_length(full_name) between 2 and 120)
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- The profile is created by the database rather than by application code, so an Auth user can
-- never exist without one. The registration action supplies role and full_name as signup
-- metadata; must_change_password is supplied only when a landlord creates a tenant account.
create function public.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name, email, must_change_password)
  values (
    new.id,
    (new.raw_user_meta_data ->> 'role')::public.user_role,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, false)
  );
  return new;
end;
$$;

create trigger create_profile_on_auth_user_insert
after insert on auth.users
for each row execute function public.create_profile_for_new_auth_user();

-- ---------------------------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------------------------

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  -- Cascade: a property has no meaning without the landlord who owns it, and ownership never
  -- transfers between accounts in this product.
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  address_line text not null,
  city text not null,
  postal_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_name_length check (char_length(name) between 2 and 120),
  constraint properties_address_line_length check (char_length(address_line) between 3 and 200),
  constraint properties_city_length check (char_length(city) between 2 and 100),
  constraint properties_postal_code_length check (
    postal_code is null or char_length(postal_code) <= 20
  )
);

create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

-- Serves: every landlord list and detail query, which filters by owner, and the RLS policy that
-- adds that filter even when the query does not.
create index properties_landlord_id_idx on public.properties (landlord_id);

-- ---------------------------------------------------------------------------------------------
-- units
-- ---------------------------------------------------------------------------------------------

create table public.units (
  id uuid primary key default gen_random_uuid(),
  -- Cascade: a unit belongs to exactly one building and cannot outlive it. Deleting a property
  -- that has lease history is refused anyway, by the restrict on leases.unit_id below.
  property_id uuid not null references public.properties (id) on delete cascade,
  -- Cascade: denormalised owner, kept for the same reason and with the same lifetime as the
  -- property's own landlord_id.
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  bedroom_count smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint units_label_length check (char_length(label) between 1 and 40),
  constraint units_bedroom_count_range check (
    bedroom_count is null or (bedroom_count >= 0 and bedroom_count <= 20)
  ),
  -- A landlord who cannot tell two units apart cannot record rent against the right one.
  constraint units_label_unique_per_property unique (property_id, label)
);

create trigger units_set_updated_at
before update on public.units
for each row execute function public.set_updated_at();

-- Serves: the landlord's unit queries. Lookups by property are already served by the leading
-- column of units_label_unique_per_property, so no separate property_id index exists.
create index units_landlord_id_idx on public.units (landlord_id);

-- ---------------------------------------------------------------------------------------------
-- leases
-- ---------------------------------------------------------------------------------------------

create table public.leases (
  id uuid primary key default gen_random_uuid(),
  -- Restrict: a unit that has ever been let carries payment and maintenance history through its
  -- leases. Removing the unit would strand that history, so the deletion is refused instead.
  unit_id uuid not null references public.units (id) on delete restrict,
  -- Cascade: denormalised owner, same lifetime as the landlord's other rows.
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  -- Set null: the lease is recorded before the tenant's account exists, and it must survive that
  -- account being removed. The tenancy is a fact about the unit, not about the login.
  tenant_profile_id uuid references public.profiles (id) on delete set null,
  rent_amount_cents integer not null,
  deposit_amount_cents integer not null default 0,
  start_date date not null,
  end_date date not null,
  rent_due_day smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leases_rent_amount_positive check (rent_amount_cents > 0),
  constraint leases_deposit_not_negative check (deposit_amount_cents >= 0),
  constraint leases_end_after_start check (end_date > start_date),
  -- Every month has a 28th, so capping the due day here removes month-length arithmetic from the
  -- rent schedule entirely.
  constraint leases_rent_due_day_range check (rent_due_day between 1 and 28),
  -- Domain invariant 1, enforced by Postgres rather than by application code. Two leases on one
  -- unit whose date ranges touch cannot both exist, and unlike a read-then-write check in the
  -- application this holds under concurrent inserts. Both endpoints are occupied, hence '[]'.
  constraint leases_no_overlap exclude using gist (
    unit_id with =,
    daterange(start_date, end_date, '[]') with &&
  )
);

create trigger leases_set_updated_at
before update on public.leases
for each row execute function public.set_updated_at();

-- Serves: the dashboard's "leases ending within sixty days", which filters by owner and ranges
-- over end_date, and the paginated lease list, which orders by the same pair.
create index leases_landlord_end_date_idx on public.leases (landlord_id, end_date);

-- Serves: every tenant page, and the tenant Row Level Security policies on rent_payments and
-- maintenance_requests, all of which begin by finding the lease belonging to auth.uid().
create index leases_tenant_profile_id_idx on public.leases (tenant_profile_id);

-- Serves: the unit detail page listing lease history. The exclusion constraint's GiST index
-- cannot answer a plain equality lookup on unit_id, so this is an addition and not a duplicate.
create index leases_unit_id_idx on public.leases (unit_id);

-- ---------------------------------------------------------------------------------------------
-- rent_payments
-- ---------------------------------------------------------------------------------------------
-- The ledger. Rent status is derived from these rows and the current date, and is never stored.

create table public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  -- Restrict: the ledger is the evidence behind every derived figure and every dispute. A lease
  -- with payments recorded against it cannot be deleted.
  lease_id uuid not null references public.leases (id) on delete restrict,
  -- Cascade: denormalised owner, used by the portfolio-wide outstanding total.
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  -- Cascade: attribution of who recorded the payment. Always the landlord, so it shares the
  -- lifetime of landlord_id above; a restrict here would deadlock that cascade instead.
  recorded_by uuid not null references public.profiles (id) on delete cascade,
  period_month date not null,
  amount_cents integer not null,
  received_on date not null,
  method public.payment_method not null,
  reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A payment points at a derived rent period by the first day of that period's month, which is
  -- what lets the schedule exist without a rent periods table to keep in step.
  constraint rent_payments_period_month_is_first_of_month check (
    extract(day from period_month) = 1
  ),
  -- Zero is not a payment and a negative payment is a refund, which this product does not record.
  constraint rent_payments_amount_positive check (amount_cents > 0),
  -- The landlord records money that has arrived, never money expected to arrive.
  constraint rent_payments_received_on_not_future check (received_on <= current_date),
  constraint rent_payments_reference_length check (
    reference is null or char_length(reference) <= 100
  )
);

create trigger rent_payments_set_updated_at
before update on public.rent_payments
for each row execute function public.set_updated_at();

-- Serves: rent status derivation, which reads one lease's payments grouped by period. This is the
-- most frequent read in the product, on the lease page, the tenant portal, and the dashboard.
create index rent_payments_lease_period_idx on public.rent_payments (lease_id, period_month);

-- Serves: the portfolio-wide outstanding total, which scans one landlord's payments.
create index rent_payments_landlord_id_idx on public.rent_payments (landlord_id);

-- ---------------------------------------------------------------------------------------------
-- maintenance_requests
-- ---------------------------------------------------------------------------------------------

create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  -- Restrict: the request belongs to the tenancy, which is what makes both parties able to see
  -- it. Deleting a lease that has reported problems would erase that shared history.
  lease_id uuid not null references public.leases (id) on delete restrict,
  -- Cascade: denormalised owner.
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  -- Restrict: who reported the problem is part of the record. Deleting a tenant account that has
  -- reported something is refused rather than silently rewriting the history.
  submitted_by uuid not null references public.profiles (id) on delete restrict,
  title text not null,
  description text not null,
  urgency public.maintenance_urgency not null default 'normal',
  status public.maintenance_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint maintenance_requests_title_length check (char_length(title) between 3 and 120),
  constraint maintenance_requests_description_length check (
    char_length(description) between 10 and 2000
  ),
  -- "Resolved" and "has a resolution date" are the same fact, so reopening a request must clear
  -- the date and resolving one must set it.
  constraint maintenance_requests_resolved_at_matches_status check (
    (status = 'resolved') = (resolved_at is not null)
  )
);

create trigger maintenance_requests_set_updated_at
before update on public.maintenance_requests
for each row execute function public.set_updated_at();

-- Serves: the dashboard's open requests panel and the landlord's maintenance list, both of which
-- filter one landlord's requests by status.
create index maintenance_requests_landlord_status_idx
  on public.maintenance_requests (landlord_id, status);

-- Serves: the tenant's own request list, and the tenant policy's lookup through the lease.
create index maintenance_requests_lease_id_idx on public.maintenance_requests (lease_id);

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------
-- Enabled with no policies attached, which denies every request that is not made with the service
-- role. The policies arrive in the next migration; until then the tables are closed rather than
-- open, which is the safer of the two states to be in between migrations.

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.leases enable row level security;
alter table public.rent_payments enable row level security;
alter table public.maintenance_requests enable row level security;
