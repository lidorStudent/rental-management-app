-- What arrived in a given month, summed by Postgres.
--
-- The dashboard opens with "rent collected this month". Reading that month's payments and adding
-- them up in the application would work, and would read more rows every month the product is used.
-- Grouping by month in the database means the figure costs one row.
--
-- security_invoker again, so the Row Level Security on rent_payments decides whose money this is.

set search_path = public;

create view public.rent_collected_by_month
with (security_invoker = on)
as
select
  landlord_id,
  date_trunc('month', received_on)::date as month,
  sum(amount_cents)::bigint as collected_cents,
  count(*)::bigint as payment_count
from public.rent_payments
group by landlord_id, date_trunc('month', received_on);

grant select on public.rent_collected_by_month to authenticated;
