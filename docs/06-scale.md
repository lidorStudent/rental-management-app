# Scale

How this application behaves as it is used more, reasoned from the queries it actually makes and
measured where measuring was possible. Numbers taken from a real run are labelled as measurements
and say where they came from; anything projected beyond what was measured is labelled an estimate.

The short version: the per-page work is small and mostly indexed, the pages that list things are
paged, and the two figures a landlord sees first are computed by Postgres rather than in JavaScript.
Two things did not scale as built, and both were found by measuring rather than by reading.

**The second is now fixed.** The deployed functions ran in Washington while the database is in
Frankfurt, so every round trip crossed the Atlantic. Pinning the region to `fra1` moved the function
into the same city as the data: `x-vercel-id` went from `fra1::iad1` to `fra1::fra1`, the health
check went from **647 ms to 338 ms**, and the median page's server time fell **66%**. Section 11
records the before and after in full.

**The first remains.** Row-level security on `rent_payments` cannot be answered from an index, so any
query that does not supply its own filter reads the whole table (measured: 566 ms against 100 ms for
the same 288 rows). Sections 3 and 9 say what to do about it.

---

## 1. How these numbers were obtained

**The query measurements** come from a script run against the **test** Supabase project
(`eu-central-1`), signed in with the anonymous key as an ordinary landlord or tenant, so every
policy applied exactly as it does in the application. Each query ran nine times; the first is
discarded because it pays for the TLS handshake, and the median of the remaining eight is reported.
The queries are copied from the pages named beside them. Two synthetic portfolios were built and
then deleted:

| | Properties | Units | Leases | Payments |
| --- | --- | --- | --- | --- |
| Small landlord | 3 | 12 | 24 | 288 |
| Large landlord | 20 | 200 | 600 | 7,200 |

Every timing includes the round trip from this laptop to Frankfurt. The floor for that, measured as
a single-row read of the reader's own profile, is **84 to 103 ms**, so subtract roughly 85 ms from
any figure below to get the part that is database work.

**The page measurements** come from Playwright driving the deployed site with the seeded demo
portfolio, six navigations per page, first discarded, median reported.

**The query plans** were taken afterwards, against the same synthetic portfolios, with
`supabase db query --linked --project-ref <test project>`, which runs SQL through the Management
API. Each plan runs inside a transaction that sets the role and the token claims the application
would arrive with, so the policies apply exactly as they do to a signed-in landlord:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<the landlord>","role":"authenticated"}';
explain (analyze, costs off, timing off, summary off) select count(*) from public.rent_payments;
rollback;
```

An earlier version of this document said no plan could be taken, because the CLI only applied
migrations. That was wrong: `supabase db query` runs arbitrary SQL and needs no database password.
The plans in section 3 confirm what the timings had only suggested.

---

## 2. What a single request costs

A landlord loading the dashboard causes **eight** round trips from the server to Supabase:

| # | Where | Call |
| --- | --- | --- |
| 1 | `src/proxy.ts` | `auth.getUser()`, which verifies the token with the Auth service |
| 2 | `src/proxy.ts` | `profiles` by primary key, for the role and the password flag |
| 3 | `src/app/landlord/layout.tsx` | `requireLandlordProfile` → `auth.getUser()` again |
| 4 | `src/lib/authentication/getSignedInProfile.ts` | `profiles` by primary key again |
| 5-8 | `src/components/dashboard/DashboardOverview.tsx` | four queries, issued together with `Promise.all` |

The first four are fixed: every protected page pays them, whatever it shows. They are also
sequential in pairs, because the profile read needs the user id that the `getUser` call returns.

This was the largest single cost of a page on the deployed site, at roughly 200 ms of Atlantic
latency. It is not any more: since the functions moved to Frankfurt, one round trip is not
measurable, so four of them are worth about as much (section 11). The reason to keep them is now
the reason they were written rather than the reason they were tolerated - the token is verified
with the Auth service rather than decoded, and the role is read from a table the user cannot edit
rather than from a token they can.

Measured on the deployed site, with the seeded portfolio:

| Page | Response headers | Fully loaded |
| --- | --- | --- |
| `/landlord` | 67 ms | 780 ms |
| `/landlord/rent` | 67 ms | 755 ms |
| `/landlord/leases` | 66 ms | 697 ms |
| `/landlord/properties` | 67 ms | 596 ms |
| `/tenant` | 68 ms | 722 ms |
| `/tenant/payments` | 68 ms | 781 ms |

The headers arrive in 67 ms because the App Router streams: the response starts before the data is
ready. "Fully loaded" is the honest number, and it includes the browser's own work as well as the
server's.

---

## 3. Tens of users, then hundreds

**At tens of landlords**, with a handful of units each, nothing here is under strain. The measured
small portfolio answers every query in 82 to 122 ms, of which roughly 85 ms is the network. Total
row counts are trivial: thirty landlords with twenty units and three years of history is about
21,600 payment rows, which is nothing for Postgres and nothing for the free tier's storage.

**At hundreds of landlords**, the arithmetic changes for one specific reason, and it is not the one
that would be guessed. Per-landlord data stays small — a landlord with twenty units still has twenty
units. What grows is the shared tables, and the queries that cannot use an index grow with them.

The measurement that shows it: the small landlord's own queries were timed alone, and then timed
again with the large landlord's 7,200 payments present in the same table. Nothing about the small
landlord changed.

| Query, as the page writes it | Small landlord alone | Same query, large landlord's rows also present |
| --- | --- | --- |
| `lease_rent_summary` (dashboard and rent overview) | 98 ms | 314 ms |
| `rent_collected_by_month`, this month (dashboard) | 92 ms | 307 ms |
| Dashboard, all four queries in parallel | 122 ms | 423 ms |
| Leases list, page 1 of 20 with count | 86 ms | 84 ms |
| Properties list, page 1 of 20 | 84 ms | 88 ms |
| Lease page: payment history, page 1 of 10 | 86 ms | (unchanged, 80 ms for the large landlord) |

The paged lists did not move. The two aggregate reads tripled, because of somebody else's rows.

One honesty note on the leases row: the synthetic portfolios were built out of consecutive past
tenancies, so the active-only filter matched nothing and no rows were serialised. What that row
shows is that the exact count over 600 leases cost nothing measurable, not that returning twenty
rows is free.

**Why.** Selecting from `rent_payments` is governed by two permissive policies, which Postgres
combines with `or`:

```
(landlord_id = (select auth.uid()) and public.current_profile_role() = 'landlord')
or public.is_current_tenant_lease(lease_id)
```

An `or` of an indexable comparison and a function call is not something an index on `landlord_id`
can answer, so unless the query supplies its own filter, every row must be fetched and the function
evaluated on each row the first branch rejects — and that function runs a query of its own. The
isolating measurement, small landlord, large landlord's rows present, the same 288 rows counted both
times:

| | |
| --- | --- |
| `count(*)` with an explicit `landlord_id` filter | **100 ms** |
| `count(*)` relying on the policy alone | **566 ms** |

That is the mechanism in one pair of numbers, and the plans say the same thing in words. Relying on
the policy alone, with 7,517 rows in the table:

```text
Seq Scan on rent_payments (actual rows=288 loops=1)
  Filter: (((landlord_id = (InitPlan 1).col1) AND (current_profile_role() = 'landlord'::user_role))
           OR is_current_tenant_lease(lease_id))
  Rows Removed by Filter: 7229
```

The same count with `where landlord_id = …` added:

```text
Index Scan using rent_payments_landlord_id_idx on rent_payments (actual rows=288 loops=1)
  Index Cond: (landlord_id = '…'::uuid)
  Filter: (((landlord_id = (InitPlan 1).col1) AND (current_profile_role() = 'landlord'::user_role))
           OR is_current_tenant_lease(lease_id))
```

Same rows, same answer: a sequential scan of the whole table with the policy evaluated on every row,
against an index scan of the reader's own rows with the policy applied only to those. The `or` is
what makes the difference, because an index on `landlord_id` cannot answer a condition whose other
branch is a function call.

**The projection.** Three hundred landlords with twenty units and three years of history is roughly
216,000 payment rows, about 29 times the 7,488 rows that produced the 566 ms count above. If the
cost stays linear — an **estimate**, and an optimistic one, since it ignores plan changes, cache
pressure and row width — the dashboard's aggregate reads would take several seconds each. That is
not a gradual decline; it is the product becoming unusable at a size it should handle comfortably.
The fix is not more hardware, and section 9 puts it first among the database changes.

The same defect has a second victim, measured directly. The tenant's payment list at
[src/app/tenant/payments/page.tsx:74](../src/app/tenant/payments/page.tsx#L74) deliberately carries
no `lease_id` filter, because row-level security supplies one; it was written that way to make the
authorisation argument obvious. With the large portfolio present:

| | |
| --- | --- |
| Tenant payments, page 1 of 20, as written | **555 ms** |
| The same query with `.eq("lease_id", lease.id)` added | **87 ms** |

The page already knows the lease id: it calls `loadTenantLease()` on the line above. Adding the
filter changes nothing about what the tenant may see, because the policy still applies underneath
it; it only gives Postgres something it can look up.

---

## 4. The heaviest queries, by file and function

In order of what they cost at size.

**1. `LeaseRentSummary` reads, in `RentOverviewPage`
([src/app/landlord/rent/page.tsx:40](../src/app/landlord/rent/page.tsx#L40)) and in
`DashboardOverview` ([src/components/dashboard/DashboardOverview.tsx:50](../src/components/dashboard/DashboardOverview.tsx#L50)).**
Measured at 468 ms and 477 ms for the large landlord, 314 ms for the small landlord in a busy table.
Two reasons, and they compound. The view sums the whole of `rent_payments` grouped by lease before
joining, so the aggregate covers rows the reader will never see; and the read is unbounded, so a
landlord with 600 tenancies receives 600 rows. Unlike the tenant list above, an explicit filter at
the call site does not rescue it — measured at 330 ms without and 327 ms with `.eq("landlord_id")` —
and the plan says why: the scan and the grouping happen inside the view, before any filter the
caller adds can apply.

```text
HashAggregate (actual rows=24 loops=1)
  Group Key: rent_payments.lease_id
  ->  Seq Scan on rent_payments (actual rows=288 loops=1)
        Filter: ((landlord_id = …) OR is_current_tenant_lease(lease_id))
        Rows Removed by Filter: 7229
```

This one needs the view changed, not the caller.

**2. `rent_collected_by_month`, in `DashboardOverview`
([src/components/dashboard/DashboardOverview.tsx:45](../src/components/dashboard/DashboardOverview.tsx#L45)).**
Measured at 318 ms for the large landlord and 307 ms for the small one in a busy table. Here the
call site can fix it, and the plan confirms it: `landlord_id` is one of the view's grouping columns,
so a filter on it becomes an `Index Scan using rent_payments_landlord_id_idx` and reaches
the underlying scan. Measured, small landlord, busy table: **314 ms as written, 91 ms with
`.eq("landlord_id", …)` added**.

**3. The tenant payment list
([src/app/tenant/payments/page.tsx:74](../src/app/tenant/payments/page.tsx#L74)).** 555 ms against
87 ms, as above.

**4. The properties list
([src/app/landlord/properties/page.tsx:46](../src/app/landlord/properties/page.tsx#L46)).** It asks
for twenty properties and, inside each, every unit and every lease's dates, to derive occupancy
without storing it. Measured at 122 ms for the large landlord against 84 ms for the small one. The
page is bounded to twenty properties, but each property's unit and lease sets are not bounded, so
this grows with the largest building rather than with the portfolio. It is fine for buildings with
tens of units and would need attention for hundreds.

**5. Everything else is flat.** The lease page's three queries (93, 82, 86 ms small; 84, 80, 80 ms
large), the leases list (86 ms and 84 ms), the tenant portal's two reads (85 and 81 ms) did not move
between the two portfolio sizes, because each of them hands Postgres an indexed column to start
from: `leases.id`, `rent_payments.lease_id`, `leases.tenant_profile_id`.

---

## 5. Every index, what it serves, and what would happen without it

Nine indexes, one unique constraint and one exclusion constraint exist beyond the primary keys. Postgres creates an index for
a primary key and for a unique constraint, and creates **none** for a foreign key, so everything
below is deliberate.

| Index | Table and columns | The query it serves | Without it |
| --- | --- | --- | --- |
| Primary keys | `profiles(id)`, and `id` on the other five tables | Every lookup by id: the proxy's profile read, `getSignedInProfile`, the lease page, the statement, every action that loads a row before writing it | Every one of those becomes a sequential scan. The proxy alone would scan `profiles` twice per request |
| `properties_landlord_id_idx` | `properties(landlord_id)` | The properties list, and the owner comparison the policy adds to it | A scan of every landlord's buildings on every list and every ownership check |
| `units_label_unique_per_property` | `units(property_id, label)` unique | Two jobs: it refuses a duplicate flat number in one building, and its leading column answers "the units in this property" for the property page and the lease form | The uniqueness rule would need a read-then-write check that concurrency defeats, and unit lookups by building would scan |
| `units_landlord_id_idx` | `units(landlord_id)` | The dashboard's unit count, and the policy's owner comparison | The dashboard's occupancy figure would scan every unit in the system |
| `leases_landlord_end_date_idx` | `leases(landlord_id, end_date)` | The leases list, which orders by the owner's leases, and the "ending soon" filter, which ranges over `end_date` | Both would scan. Measured as a probe: a date-bounded lease query stayed at 79 ms with 600 leases present, which is what this index buys |
| `leases_tenant_profile_id_idx` | `leases(tenant_profile_id)` | Every tenant page, because the portal resolves the tenancy from the session, and the tenant policies on `rent_payments` and `maintenance_requests`, which all begin by finding that lease | The tenant portal would scan every lease in the system on every page, and so would each row's policy check |
| `leases_unit_id_idx` | `leases(unit_id)` | The unit and property pages, which list a unit's tenancy history and derive occupancy | Occupancy on the properties list would scan the lease table once per unit shown |
| `leases_no_overlap` | GiST on `(unit_id, daterange(start_date, end_date, '[]'))` | Not a read optimisation: it is domain invariant 1. Postgres refuses a second tenancy whose dates touch an existing one, under concurrency, which an application check cannot do | Two landlords, or one landlord clicking twice, could double-let a flat. Every screen that assumes one active lease per unit would be wrong |
| `rent_payments_lease_period_idx` | `rent_payments(lease_id, period_month)` | The most frequent read in the product: the rent schedule on the lease page and the tenant portal, both through `lease_period_totals`, and the payment history list | Measured indirectly: reads that use it stay at ~80 ms with 7,200 payments present, while the same table read without an indexable filter takes 555 ms |
| `rent_payments_landlord_id_idx` | `rent_payments(landlord_id)` | The portfolio-wide totals — when the query names the column. Section 3 is the story of what happens when it does not | The 100 ms count in section 3 would be a 566 ms count for everybody, always |
| `maintenance_requests_landlord_status_idx` | `maintenance_requests(landlord_id, status)` | The dashboard's open-problem count and the landlord's maintenance list with its status filter | The dashboard count would scan every request in the system |
| `maintenance_requests_lease_id_idx` | `maintenance_requests(lease_id)` | The tenant's own list of reported problems, and the tenant policy's lookup through the lease | The tenant's maintenance page would scan the whole table, and so would each policy check |

**Two foreign keys have no index**, and that is a decision rather than an oversight:
`rent_payments.recorded_by` and `maintenance_requests.submitted_by`. Nothing reads by either column;
they exist for attribution. The cost shows up only when a profile is deleted, because Postgres must
then check the referencing rows — a table scan on an operation that happens once in an account's
life. If deletions ever became common, these are the first two indexes to add.

---

## 6. What is deliberately not loaded

**Columns are named, never `select("*")`.** Every read lists what the screen uses. The lease list
asks for seven columns and two joined names; the dashboard's tenancy read asks for nine. It keeps
the JSON small over a link that, on the deployed site, crosses the Atlantic.

**Counts come back without rows.** `count: "exact", head: true` asks Postgres for a number and
returns no rows at all: the dashboard's unit count and open-problem count, and the health check's
liveness probe, all use it.

**Sums are computed in SQL.** Three views exist for this
([supabase/migrations/20260825191750_rent_aggregate_views.sql](../supabase/migrations/20260825191750_rent_aggregate_views.sql),
[20260825192842](../supabase/migrations/20260825192842_rent_collected_by_month_view.sql)):
`lease_rent_summary` gives one row per tenancy with its ledger already summed, `lease_period_totals`
one row per month that has had anything paid against it, and `rent_collected_by_month` one row per
month per landlord. The lease page shows a status for every month of a three-year tenancy while
reading at most thirty-six rows rather than every payment behind them; measured at 82 ms with the
large portfolio present. This is the part of the design that does scale, and it is why sections 3
and 4 are about how those rows are filtered rather than about how many there are.

**Date-bounded reads.** The statement
([src/components/statement/RentStatement.tsx:52](../src/components/statement/RentStatement.tsx#L52))
is the one place that reads payment rows individually, because a statement lists them. It is bounded
by `period_month` between the two ends of the chosen range, and `chooseStatementRange` defaults
that range to the whole tenancy up to today, clamped inside the tenancy's own dates whatever the
URL asks for. The dashboard's "ending in the next sixty days" is a date comparison too, though it is
applied to rows already fetched for another figure rather than issued as its own query.

**One query serving several figures.** `DashboardOverview` reads `lease_rent_summary` once and
derives three of its five numbers from it: what is owed, how many units are let, and which tenancies
end soon. The comment in that file records that it was seven queries before that consolidation.

---

## 7. Pagination

Five lists are paged, all identically: leases, properties and maintenance for the landlord, payments
and maintenance for the tenant, twenty rows each, and the payment history inside a lease page at ten.

The implementation is three small pure functions and one Supabase call:

- `parsePageNumber` ([src/lib/pagination/parsePageNumber.ts](../src/lib/pagination/parsePageNumber.ts))
  turns whatever `?page=` contains — absent, `0`, `-3`, `two`, a repeated parameter — into a page
  number, because none of those deserves an error page.
- `pageRange` ([src/lib/pagination/describePage.ts](../src/lib/pagination/describePage.ts)) turns a
  page number into the zero-based inclusive range `.range()` expects, and `describePage` turns the
  same numbers plus the total into what the reader is shown, so the two can never disagree.
- The query adds `{ count: "exact" }` and `.range(startIndex, endIndex)`. PostgREST answers with the
  page and the total in the `Content-Range` header, in one round trip.
- `isPageBeyondTheEnd` ([src/lib/pagination/isPageBeyondTheEnd.ts](../src/lib/pagination/isPageBeyondTheEnd.ts))
  catches PostgREST's `PGRST103`, which is what a stale bookmark to page nine of a list that now has
  four pages produces, and the page redirects to the first page instead of claiming the list is
  empty.

**Why offset paging rather than keyset paging.** Keyset paging — "give me the twenty rows after this
one" — stays fast at any depth, because it never counts and never skips. Offset paging asks Postgres
to find and discard the first *n* rows, and asking for an exact count means scanning the matching set
every time. At a hundred thousand rows deep, keyset wins decisively.

This product does not have that problem and does have the opposite one. A landlord's lease list is
tens of rows, and the reader wants to see "21 to 40 of 63" and jump to the last page. Keyset paging
cannot number pages or jump, because it does not know where it is. The measured cost of the exact
count here is nothing: the leases list took 86 ms with 24 leases and 84 ms with 600. The rule this
follows is the one in `CLAUDE.md` — between two working approaches, choose the one that is easier to
explain — and the honest note is that if a single landlord ever has tens of thousands of leases,
this choice is wrong and keyset is right.

**What is not paged, and should be watched.** The rent overview and the dashboard's tenancy read are
unbounded by design: they answer "what am I owed across everything", which is not a question a page
of twenty answers. At 600 tenancies that is a 468 ms query returning 600 rows. Section 9 says what to
do about it, and when.

---

## 8. Client and server

The split is not a convention here; the framework enforces it, and the code is arranged so that the
enforcement is visible.

**Reads happen in server components.** Every `.from(...)` outside `src/actions/` is in a file with no
`"use client"` at the top: the pages, `DashboardOverview`, `LeaseRentSchedule`, `LeasePaymentHistory`,
`TenantRentPosition`, `loadTenantLease`, `RentStatement`. They run on the server, use the session
cookie, and send HTML. No component fetches data from the browser, there is no client-side data
library, and there is no browser Supabase client at all — the file that used to create one was
deleted, so importing it is impossible rather than merely discouraged.

**Writes happen in server actions.** All twenty are in `src/actions/`, each beginning `"use server"`,
each starting with a role guard and a Zod parse. A form posts to one; nothing in the browser
constructs a database query, because nothing in the browser can.

**What is a client component, and why.** Twenty-five of the fifty-one files in `src/components`, and every one of them
is there for interaction rather than for data: the forms, which use react-hook-form for field-level
feedback; the navigation, which highlights the current link; the delete buttons, which confirm; the
print button, which calls `window.print()`. The parent server component reads the data and hands it
down as props — `LandlordLayout` reads the profile once and passes the name to the navigation, which
is why no client component ever needs to ask who is signed in.

**What that costs the browser.** The whole client bundle across every route is **900 KB uncompressed
in 31 chunks** (measured from `.next/static/chunks` after a production build). React and the router
are most of it; this project's own client code is small, because most of the application is not
client code.

**Where the derived rules run.** The pure functions in `src/lib/` — the rent schedule, the status
derivation, the overlap check, the money parsing — are imported by both sides. They run on the
server when a page renders and in the browser when a form validates, from one definition. That is
deliberate: the client copy is convenience, the server copy is the trust boundary, and because it is
one file they cannot drift.

---

## 9. Limitations, plainly

**~~The functions and the database are on different continents.~~ Fixed on 27 August 2026.** This
was the largest and cheapest-to-fix number in this document, and it is now done: `vercel.json` pins
`"regions": ["fra1"]`, and the deployed site reports `x-vercel-id: fra1::fra1` where it used to
report `fra1::iad1`. Section 11 has the measurements. What it leaves behind is worth stating,
because it changes the value of everything else on the list: **one round trip from the function to
the database is no longer measurable at all.**

**Row-level security cannot be answered from an index on `rent_payments`.** Sections 3 and 4, with
the measurements. This is the one that turns into a real problem at hundreds of users.

**Every aggregate is computed on request.** There is no materialised view and no cached figure. A
landlord refreshing the dashboard five times recomputes the same sums five times. That is the right
default — the figures are always true, and the alternative is a staleness rule to explain — but it is
a choice with a ceiling.

**No caching layer of any kind.** No Redis, no cached fetch, no revalidation window. The build
marks every route server-rendered on demand except `/register` and the not-found page, because
everything else depends on the signed-in user. Two identical
requests one second apart do identical work.

**One landlord account per person, and one person per portfolio.** Ownership is a single
`landlord_id` on every row. There is no organisation, no second user on a portfolio, no letting agent
managing several landlords' buildings, and no way to hand a portfolio over. Adding any of those means
adding a membership table and rewriting every policy that currently compares one column to
`auth.uid()`.

**Free tier ceilings.** These are the published limits for the plans in use, not something measured
here: the Supabase free plan allows 500 MB of database storage, 5 GB of egress a month and 50,000
monthly active users, and pauses a project after a week without activity — which is why
`/api/health` and the daily workflow exist. Vercel's Hobby plan allows 100 GB of bandwidth a month
and is licensed for non-commercial use. **Estimate:** at roughly 200 bytes a row with indexes,
216,000 payments and their supporting rows are well under 100 MB, so storage is not the binding
limit; the monthly active user count and the non-commercial licence are.

**Single region, single instance, no replicas.** One Postgres instance in Frankfurt, no read replica,
no failover. If it is down, the application is down, and the health check will say so.

---

## 10. What I would change, in order

The order is by measured effect divided by risk. The first two are small changes with large numbers
behind them; the rest matter later.

**1. ~~Move the Vercel functions to `fra1`.~~ Done, 27 August 2026.** One line in `vercel.json`. It
removed an Atlantic crossing from all eight round trips of every page. Predicted here at roughly
0.4 s of the health check's 0.5 s; measured afterwards at **647 ms → 338 ms** on the health check and
a **66% median reduction** in page server time. No code changed. Section 11 has the table.

**2. Give the queries something indexable to start from.** Two edits, both measured:
`.eq("lease_id", lease.id)` on the tenant payment list (555 ms → 87 ms) and `.eq("landlord_id", …)`
on the dashboard's `rent_collected_by_month` read (314 ms → 91 ms). Neither weakens anything: the
policies still apply underneath, and the tests in `tests/tenantIsolation.test.ts` prove it by asking
for another tenant's rows explicitly. Second because it is nearly free and removes most of the
per-request database time.

**3. Rework `lease_rent_summary` so its sum covers one landlord's rows.** Measured at 330 ms with the
filter and 327 ms without, because the grouping happens before any filter reaches it — so unlike
item 2, this needs the view rewritten, most likely by carrying `landlord_id` into the grouped
subquery so the owner comparison can reach the scan. It is third rather than second because it is a
migration and a change to a definition three screens depend on, so it needs its own measurement
before and after rather than a confident edit.

**4. ~~Cut the fixed four round trips per request to two.~~ Withdrawn.** The proxy verifies the user
and reads the profile; the layout does both again a moment later. This was worth roughly 200 ms of
Atlantic latency, and this document already guessed it would be worth roughly 20 ms once item 1 was
done. The measurement in section 11 is blunter than that guess: **one round trip is worth 0 ms** now,
so the whole item is worth 0 ms. It was also the item that pressed hardest against the security
boundary — every route to it either trusts a token the server has not verified, reads the role from
somewhere the user can edit, or moves a role across a header a client can forge. It is withdrawn on
the arithmetic, which is the best reason to withdraw something.

**5. Bound the two unbounded reads.** The rent overview and the dashboard tenancy list return one row
per tenancy ever recorded. Filtering to tenancies that are active or ended with money outstanding —
a condition the database can apply — would keep both flat as history accumulates. Fifth because it
only bites past a few hundred tenancies for one landlord, which is beyond what this product is for.

**6. Index the two attribution foreign keys**, `rent_payments.recorded_by` and
`maintenance_requests.submitted_by`, if account deletion ever stops being rare. Cheap, and pointless
until then.

**7. Cache the dashboard figures with a short revalidation window.** Only after 1 to 4, because those
make the figures cheap enough that caching them buys little, and a cache is a staleness rule that has
to be explained to a landlord looking at a number that is thirty seconds old.

**8. Then, and only with a measurement in hand, consider a materialised summary table** maintained by
trigger, replacing the derived-on-read model for the portfolio-wide figures. It is last because it
trades the invariant this whole product is built on — that rent status is derived and never stored —
for speed, and nothing measured here says that trade is needed.

---

## 11. The region move, measured

Recorded on 27 August 2026, after `vercel.json` was given `"regions": ["fra1"]`. Everything here was
measured the same way as section 1's page numbers: Playwright against the deployed site, eleven
navigations per route, the first three discarded to clear cold starts, median of the remaining
eight. The figure is `responseEnd − requestStart` on the navigation entry, which spans the whole
streamed document and therefore every Supabase round trip the page makes.

The account is on the Hobby plan, which allows exactly one region. That was confirmed on a preview
deployment before production saw the change: the preview built and returned `x-vercel-id: fra1`.

**Where the function runs.** `x-vercel-id: fra1::iad1` before, `fra1::fra1` after.

**The health endpoint**, which is one `count` and no session work, over ten warm calls:

| | median | fastest | slowest |
| --- | --- | --- | --- |
| Washington | 647 ms | 480 ms | 1167 ms |
| Frankfurt | **338 ms** | 291 ms | 666 ms |

**Server time per page**, before and after:

| Route | Washington | Frankfurt | Saved |
| --- | --- | --- | --- |
| `/landlord` | 564 ms | 385 ms | 179 ms, 32% |
| `/landlord/properties` | 505 ms | 195 ms | 310 ms, 61% |
| `/landlord/leases` | 518 ms | 199 ms | 319 ms, 62% |
| `/landlord/leases/[id]` | 478 ms | 210 ms | 268 ms, 56% |
| `/landlord/leases/[id]/payments/new` | 476 ms | 180 ms | 296 ms, 62% |
| `/landlord/leases/[id]/statement` | 953 ms | 236 ms | 717 ms, 75% |
| `/landlord/rent` | 570 ms | 176 ms | 394 ms, 69% |
| `/landlord/maintenance` | 552 ms | 178 ms | 374 ms, 68% |
| `/landlord/properties/new` | 563 ms | 193 ms | 370 ms, 66% |
| `/tenant` | 629 ms | 189 ms | 440 ms, 70% |
| `/tenant/lease` | 494 ms | 180 ms | 314 ms, 64% |
| `/tenant/payments` | 798 ms | 224 ms | 574 ms, 72% |
| `/tenant/maintenance` | 553 ms | 167 ms | 386 ms, 70% |
| `/tenant/statement` | 663 ms | 232 ms | 431 ms, 65% |

Median saving **372 ms**, median reduction **66%**. The deployed smoke suite, which signs in as both
seeded roles and walks their pages, fell from 26.1 s to **14.5 s** over the same change.

### What it cost the rest of the list

One round trip from the function to the database is no longer measurable. Three pages that differ
only in how many queries of their own they make, 41 navigations each, first five discarded, median
of 36:

| Page | Its own queries | p25 | median | p75 |
| --- | --- | --- | --- | --- |
| `/landlord/properties/new` | none | 241 ms | 259 ms | 282 ms |
| `/landlord/rent` | one | 245 ms | 259 ms | 279 ms |
| `/landlord/leases` | one | 236 ms | 254 ms | 280 ms |

The gap is **0 ms and −5 ms**, against a p25-to-p75 spread of about 20 ms.

That number retired a change this document had recommended. Three pages issued two reads one after
the other where neither needed the other's answer, and running them together halves the pair:
measured from a machine 85 ms from the database, 177→86 ms, 167→88 ms and 176→90 ms. Each pair saves
exactly one round trip, and one round trip is now free, so the change was written, measured, and
reverted. The lesson is worth more than the change would have been: **fix the latency before
optimising the number of round trips, because the first fix decides whether the second is worth
anything.**

Two costs are unchanged by this, because neither was ever about geography: row-level security on
`rent_payments` still cannot be answered from an index (section 3), and every aggregate is still
computed per request (section 9).
