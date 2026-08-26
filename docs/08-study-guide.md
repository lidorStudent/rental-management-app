# Study guide

One path from knowing nothing about this project to explaining it under questioning. It replaces
reading the four notes in [docs/learning/](learning/) one at a time; those stay as the longer
treatment of each subject.

Work through it in order. Each part assumes the one before it.

---

## Part 0: the route

| Step | Time | What to do |
| --- | --- | --- |
| 1 | 5 min | Read part 1 below. Be able to say what the product is in three sentences |
| 2 | 20 min | Part 2, the five concepts. These are what an examiner will actually test |
| 3 | 20 min | Part 3, the ten files. Open each one while you read about it |
| 4 | 20 min | Parts 4 and 5, a request and the rules. Follow the trace with the files open |
| 5 | 10 min | Part 6, what the tests prove |
| 6 | 25 min | Part 7, the twenty questions. Answer each aloud before reading the answer |

---

## Part 1: the product, in one minute

A landlord with a few flats records their buildings, the units in them, and who rents which unit for
how long at what rent. They write down rent as it arrives. The system works out, from that ledger
and today's date, what is paid, part paid, due or overdue - the landlord never types a status.
Tenants sign in to a portal that shows only their own tenancy, what they have paid, what is
outstanding, and the problems they have reported. It records money that arrived; it does not move
money.

Five rules the whole design serves, in the words used everywhere in this repository:

1. A unit can never have two overlapping active leases.
2. Rent status is always derived from the ledger and the current date, never typed in.
3. A tenant can only ever read or write rows belonging to their own lease.
4. A landlord can only ever read or write rows they own.
5. Rent is a ledger of payments the landlord records as received. This is not a payment processor.

---

## Part 2: the five concepts to know cold

### 1. Cookie sessions

When somebody signs in, Supabase Auth issues a short-lived access token, a signed JWT valid for one
hour, and a longer-lived refresh token, and `@supabase/ssr` stores both in a single browser cookie.
Every later request carries that cookie automatically, so the server can ask Supabase who is
calling; when the access token has expired, the refresh token is exchanged for a new one and the
cookie is rewritten. The cookie is the whole of the session: there is no server-side session store
to keep, which is what lets this application run as stateless functions.

**In this codebase:** the cookie is written in the `setAll` of
[src/lib/supabase/serverClient.ts](../src/lib/supabase/serverClient.ts) and
[src/lib/supabase/middlewareClient.ts](../src/lib/supabase/middlewareClient.ts), both passing the
flags through [src/lib/supabase/sessionCookieOptions.ts](../src/lib/supabase/sessionCookieOptions.ts)
- `httpOnly`, `sameSite=lax`, `secure` in production. It is refreshed in
[src/proxy.ts](../src/proxy.ts) on every request, and `redirectTo` in that file copies the refreshed
cookie onto a redirect response so a rotation is never thrown away.
[e2e/sessionCookie.spec.ts](../e2e/sessionCookie.spec.ts) proves page JavaScript cannot read it and
that an expired token is still refreshed.

**Say this if asked why it is HTTP-only:** the cookie holds the refresh token as well as the access
token, so a script that could read it could keep the session alive after the tab closed;
`@supabase/ssr` leaves it readable so its browser client can hydrate from it, and this project has
no browser client, so the default was paying a cost for a feature it never used.

### 2. Row Level Security

Row Level Security is a Postgres feature that attaches a rule to a table saying which rows the
current database user may see or change, and the rule is applied to every query, including ones the
application forgot to filter. Supabase runs each request as the signed-in user, with `auth.uid()`
returning that user's id, so a policy like `landlord_id = auth.uid()` means a landlord's query
returns their rows and nobody else's without the query mentioning ownership at all. Because the rule
lives in the database rather than in the code paths above it, a bug in a page produces an empty
result rather than a leak.

**In this codebase:** 29 policies in
[supabase/migrations/20260825122721_row_level_security.sql](../supabase/migrations/20260825122721_row_level_security.sql).
Landlord policies compare `landlord_id = (select auth.uid())` and also check the role; tenant
policies call `security definer` helpers such as `is_current_tenant_lease(lease_id)`. The three
aggregate views are `security_invoker = on` so they run under the caller's policies.
[tests/landlordIsolation.test.ts](../tests/landlordIsolation.test.ts) and
[tests/tenantIsolation.test.ts](../tests/tenantIsolation.test.ts) attack the database directly to
prove it.

**Say this if asked why a policy is not enough on its own:** a policy chooses rows, not columns, so
two triggers do what policies cannot - `profiles_role_is_immutable` freezes a role, and
`maintenance_requests_tenant_confirms_only` limits a tenant's confirmation to one column.

### 3. Server components against client components

In the Next.js App Router every component is a server component unless its file starts with
`"use client"`: server components run only on the server, can be `async`, can query the database
directly, and send finished HTML to the browser. A client component is compiled into the browser
bundle and can use state, effects and event handlers, but it has no access to the session or the
database and everything it needs must be passed to it as props. The split decides where data
fetching happens, and therefore where authorisation happens.

**In this codebase:** every `.from(...)` outside `src/actions/` is in a server component -
[src/app/landlord/page.tsx](../src/app/landlord/page.tsx),
[src/components/dashboard/DashboardOverview.tsx](../src/components/dashboard/DashboardOverview.tsx),
[src/components/tenant/loadTenantLease.ts](../src/components/tenant/loadTenantLease.ts). Twenty-five
of the fifty-one component files are client components, and every one of them is there for
interaction: forms, the navigation, delete confirmations, the print button. There is no Supabase
client in the browser at all.

**Say this if asked how you decide:** start on the server, and move a leaf to the client only when
it needs an event handler or state. `LandlordLayout` reads the profile once and passes the name to
the navigation as a prop, which is why nothing in the browser has to ask who is signed in.

### 4. Server actions

A server action is a function marked `"use server"` that the client can call as if it were local,
while it actually runs on the server: React turns the call into an HTTP request, runs the function
there, and returns its value. That makes it the natural place for a write, because the session, the
validation and the database access are all on the trusted side of the wire. It also means an action
is a real endpoint that anyone can call with any payload, so it must guard itself rather than trust
the form that normally calls it.

**In this codebase:** twenty actions in [src/actions/](../src/actions/), each following the same
seven steps documented at the top of
[src/actions/propertyActions.ts](../src/actions/propertyActions.ts): resolve the acting user, refuse
the wrong role, parse with Zod, apply the business rules, write with Row Level Security as the last
word, revalidate the affected pages, return a typed `ActionResult`. No action ever takes an owner
identifier from its input; `landlord_id` comes from the session.
[tests/serverActions.test.ts](../tests/serverActions.test.ts) calls them the way a forged request
would.

**Say this if asked about security:** the guard is the first line of every action, not the form. A
hostile client posting a well-formed payload meets `requireLandlordProfile`, then the schema, then
the policies, in that order.

### 5. Derived state against stored state

Stored state is a value written into a column and kept up to date by whatever changes it; derived
state is computed from the rows that already exist, every time it is needed. Stored state is faster
to read and can silently disagree with reality - a rent status that says "paid" because nothing ran
when the month turned, an `is_occupied` flag left true after a tenancy ended. Derived state cannot
drift, because there is nothing to drift from; the price is that it must be computed on each read,
which is only affordable if the aggregation is done where the data is.

**In this codebase:** rent status comes from
[src/lib/rent/deriveRentStatus.ts](../src/lib/rent/deriveRentStatus.ts) over a schedule built by
[src/lib/rent/buildRentSchedule.ts](../src/lib/rent/buildRentSchedule.ts); a lease's lifecycle from
[src/lib/leases/describeLeaseLifecycle.ts](../src/lib/leases/describeLeaseLifecycle.ts); a unit's
occupancy from [src/lib/leases/describeUnitOccupancy.ts](../src/lib/leases/describeUnitOccupancy.ts).
There is no status column on `leases`, no occupancy flag on `units`, and no `rent_periods` table. The
sums are done by three Postgres views so that deriving stays cheap.

**Say this if asked about the cost:** a lease page reads one row per month from
`lease_period_totals` rather than one row per payment, measured at 82 ms with 7,200 payments in the
table, and [docs/06-scale.md](06-scale.md) prices the rest.

---

## Part 3: the ten files that matter most

Open each one as you read.

| # | File | What it does |
| --- | --- | --- |
| 1 | [src/proxy.ts](../src/proxy.ts) | Runs before every request. Refreshes the session, reads the role from the database, and redirects: no session to `/login`, wrong area to the right one, a forced password change to `/change-password` |
| 2 | [src/lib/authentication/getSignedInProfile.ts](../src/lib/authentication/getSignedInProfile.ts) | The single place the acting user is decided. `getUser()` verifies the token with the Auth service; the role then comes from `profiles`, never from the token |
| 3 | [src/lib/supabase/serverClient.ts](../src/lib/supabase/serverClient.ts) | The client every page and action uses, carrying the session, so every query runs as that user |
| 4 | [supabase/migrations/20260825122011_core_schema.sql](../supabase/migrations/20260825122011_core_schema.sql) | The six tables with their constraints, indexes and triggers - including the exclusion constraint that makes overlapping tenancies impossible |
| 5 | [supabase/migrations/20260825122721_row_level_security.sql](../supabase/migrations/20260825122721_row_level_security.sql) | The 29 policies and the `security definer` helpers. The actual authorisation boundary |
| 6 | [src/actions/propertyActions.ts](../src/actions/propertyActions.ts) | The shape every action follows, documented at the top. Learn this one and you have learned all twenty |
| 7 | [src/actions/leaseActions.ts](../src/actions/leaseActions.ts) | The headline business rule in code: `refuseIfDatesAreTaken`, the message naming the earliest free date, and the `23P01` fallback when the database wins a race |
| 8 | [src/lib/rent/buildRentSchedule.ts](../src/lib/rent/buildRentSchedule.ts) | The months a tenancy owes for, derived from its dates, with a status per month from `deriveRentStatus` |
| 9 | [src/components/tenant/loadTenantLease.ts](../src/components/tenant/loadTenantLease.ts) | The tenant portal's whole authorisation argument: a query with no filter naming a lease or a tenant, answered by the policy |
| 10 | [tests/serverActions.test.ts](../tests/serverActions.test.ts) | The attacker's view: the wrong role, a forged identifier, and where ownership actually comes from |

---

## Part 4: one request, end to end

The version to draw on a whiteboard. The long form is
[docs/learning/01-auth-and-database.md](learning/01-auth-and-database.md) and
[docs/learning/03-data-flow.md](learning/03-data-flow.md).

```text
1. Browser sends the session cookie with the request.
2. src/proxy.ts       getUser() verifies it with Auth, rotating the token if it expired.
                      profiles gives the role. Wrong area? Redirect. No session? /login.
3. layout.tsx         requireLandlordProfile() or requireTenantProfile() asserts the role again,
                      on the server, where it cannot be skipped.
4. page.tsx           A server component queries through createSupabaseServerClient().
5. Postgres           Row Level Security adds the owner condition to the query, whether or not
                      the query mentioned it. Rows that are not yours do not exist.
6. The rules          Pure functions turn rows plus today's date into what is shown:
                      status, lifecycle, occupancy, outstanding.
7. HTML               Sent to the browser. The shell first, suspended panels as they resolve.
```

A write is the same picture with two changes: the entry point is a server action rather than a page,
and step 6 happens before step 5 - validate, apply the rules, then write, with the policy as the
last word. Afterwards `revalidatePath` marks the affected pages stale so the next read recomputes.

**The sentence that ties it together:** the identity comes from the cookie, the role comes from the
database, the rows come from the policy, and the numbers come from the rules. No part of that chain
trusts the browser.

---

## Part 5: the rules, and where each one lives

The long form is [docs/learning/02-business-rules.md](learning/02-business-rules.md).

**Overlap.** Both endpoint dates belong to a tenancy, so one running to 31 May conflicts with one
starting on 31 May, and the next tenancy may start on 1 June.
[src/lib/leases/findConflictingLease.ts](../src/lib/leases/findConflictingLease.ts) is the pure
function; `leases_no_overlap` is the exclusion constraint that holds under concurrency. The function
exists for the message, the constraint for the guarantee.

**Rent status.** `buildRentSchedule` turns a lease into one period per month, each with a due date
from `rent_due_day`. `deriveRentStatus` compares what is due against what was received, and today's
date: nothing received and the due date passed is `overdue`; something but not enough is `partial`;
enough is `paid`; not yet due is `due`. A total is allocated to the oldest unpaid month first, and
credit on one tenancy is never netted against arrears on another.

**Maintenance.** `submitted` → `acknowledged` → `in_progress` → `resolved`, with reopening allowed
from `resolved`. [src/lib/maintenance/allowedStatusTransitions.ts](../src/lib/maintenance/allowedStatusTransitions.ts)
is the rule; the interface does not render an illegal move and the action refuses it anyway. The
tenant's confirmation afterwards is one column, guarded by a policy and a trigger.

**Where a rule lives, and why:** in a pure function when it needs only its inputs and today's date;
in a Zod schema when it is about the shape of what somebody typed; in a constraint when it must be
true of every row however it got there. Several rules are in two places on purpose, and the
duplication is deliberate rather than accidental - the constraint is the guarantee, the function is
the explanation.

---

## Part 6: what the tests prove

The long form is [docs/learning/04-security-model.md](learning/04-security-model.md).

| Suite | Proves |
| --- | --- |
| `npm test`, 325 tests | The rules are right at their boundaries, and the forms behave, including for a screen reader |
| `npm run test:db`, 98 tests | The policies and constraints hold against a real Postgres, as real signed-in users |
| `npm run test:e2e`, 15 tests | The whole processes work in a browser, including the refusals |

**The one to be able to defend:** the permission tests do not drive the interface. Driving the
interface only proves the interface offered no way in, and an attacker will not use the interface.
The suite signs in as landlord A with a real password and asks PostgREST directly for landlord B's
rows - by id, by filter, through the views, with updates and deletes as well as selects - so the
only thing that can refuse is Postgres. It also includes a positive control, landlord A doing the
whole cycle on their own rows, because a policy that refused everything would otherwise pass.

---

## Part 7: twenty questions, likeliest first

**1. What does the application do?**
It records buildings, units, tenancies, rent received and reported repairs for a small landlord, and
gives each tenant a portal showing their own tenancy. Rent status is derived from the ledger and
today's date, so nobody types "paid".

**2. Why Supabase rather than your own backend?**
It is Postgres with authentication and Row Level Security in one instance, so authorisation can live
in the database next to the data rather than in a middle tier I would have to write and secure. What
I gave up is control over the Auth implementation; what I gained is not hand-rolling password
hashing.

**3. How do you know a landlord cannot see another landlord's data?**
Because the policies compare `landlord_id` to `auth.uid()` on every table, and because
`tests/landlordIsolation.test.ts` signs in as one landlord and asks the database directly for the
other's rows - 26 tests, including updates and deletes, plus a positive control proving the same
landlord can do all of it to their own rows.

**4. Walk me through what happens when a landlord records a payment.**
The form calls `recordRentPayment`; the action resolves the landlord from the session, parses the
input with a schema built around today's date so a future receipt is refused, reads the lease -
another landlord's is invisible - checks the month falls inside the tenancy, inserts with
`landlord_id` and `recorded_by` taken from the session, and revalidates the pages that changed. The
badge on the next render changes because `deriveRentStatus` sees a different total, not because
anything wrote a status.

**5. Why is rent status not a column?**
Because it depends on today's date as well as on the ledger, so a stored value would be wrong the
morning after it was written unless a job ran to fix it. Deriving it cannot drift, and the sums are
done by Postgres views so deriving stays cheap.

**6. What stops two tenancies overlapping on one unit?**
A Postgres exclusion constraint, `exclude using gist (unit_id with =, daterange(start_date,
end_date, '[]') with &&)`. The application also checks, to produce a message naming the earliest free
date, but the constraint is what holds when two requests race.

**7. What is Row Level Security, in your own words?**
A rule attached to a table that decides which rows the current user may see or change, applied to
every query whether or not the query mentions ownership. It means a forgotten filter returns nothing
instead of somebody else's rows.

**8. Where does the session live, and why is that safe?**
In one HTTP-only cookie holding the access and refresh tokens, written by the server and never
readable by page JavaScript. It is verified on every request with `getUser()`, which asks the Auth
service rather than trusting what the cookie claims.

**9. What is the difference between a server component and a client component here?**
Server components query the database and send HTML; client components are for interaction and get
everything as props. Twenty-five of fifty-one component files are client components, and none of
them can reach the database, because there is no Supabase client in the browser.

**10. How does a tenant account get created without an email service?**
The landlord creates it from the lease screen: `createTenantAccountForLease` checks the lease is
theirs, generates a fourteen-character password with `node:crypto`, creates the account with
`must_change_password`, and shows the password once. Nothing stores it afterwards, and the tenant is
forced to change it before they can use the portal.

**11. Could a tenant see another tenant's data by changing a URL?**
There is no identifier in any tenant URL to change: `loadTenantLease` resolves the tenancy from the
session. The one route that takes parameters is the statement's month range, which is clamped inside
the tenancy's own dates, and the end-to-end tests try to construct such a URL and cannot.

**12. What happens if somebody calls a server action directly with a forged payload?**
They meet the same three things a form does, in the same order: the role guard, the Zod parse, and
the policies. `tests/serverActions.test.ts` does exactly that, and two of its tests prove that
another landlord's identifier produces the same message a missing record does, so the answer leaks
nothing.

**13. Why validate on both the client and the server?**
The client run is convenience - errors appear as somebody types - and the server run is the trust
boundary, because anything can post to an action. They cannot drift because both import the same Zod
schema from `src/lib/validation/`.

**14. Why is money an integer?**
Because a ledger is addition, and floating point addition loses cents. Amounts are whole agorot,
parsed from typed text by `parseCurrencyInputToCents` without ever multiplying a float.

**15. How is the rent schedule generated without a periods table?**
`buildRentSchedule` derives one period per month from the lease's start date, end date and due day,
and a payment points at a period by the first day of its month - enforced by a check constraint. A
periods table would be a second thing to keep in step every time a tenancy is ended early or
renewed.

**16. What are the three views for, and what does `security_invoker` mean?**
`lease_rent_summary`, `lease_period_totals` and `rent_collected_by_month` sum the ledger in Postgres
so no screen reads payments row by row. `security_invoker = on` makes a view run under the policies
of whoever selects from it; without it, the view would return every landlord's rows to anybody.

**17. What would break first if this had hundreds of landlords?**
The two aggregate reads on the dashboard and the rent overview. Measured: a small landlord's
`lease_rent_summary` query went from 98 ms to 314 ms purely because another landlord's 7,200 payments
existed, because the row-level predicate on `rent_payments` cannot be answered from an index when the
query supplies no filter of its own. It is measured, priced and given a fix order in
[docs/06-scale.md](06-scale.md).

**18. What is the weakest part of the security model?**
The temporary password that travels out of band, and the fact that the session is still a bearer
token, so an injected script could act as the user through the application even though it cannot
read the cookie. Both are stated in [docs/05-security.md](05-security.md) along with no rate limiting
on the application's own endpoints, no MFA and no audit log.

**19. Why is the role read from the database on every request instead of from the token?**
Because a signed-in user can edit their own token metadata through the Auth API, and cannot edit
their profile row - `profiles_role_is_immutable` refuses it. It costs one indexed lookup per
request, which the scale document prices and puts fourth on the list of things to change.

**20. If you had to defend one decision as the most important, which and why?**
Putting authorisation in the database. Everything else in the project could be rewritten - the
framework, the interface, even the actions - and the guarantee would survive, because it does not
depend on any of them being correct. It is also the only decision I can prove rather than assert:
98 tests attack the database directly, and they are the evidence that the claim is true.
