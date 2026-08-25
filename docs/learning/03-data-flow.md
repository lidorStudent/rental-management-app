# Two journeys through the system

A study note built for narrating out loud. It follows one write and one read, end to end, naming
every file in the order it runs. If you can tell these two stories at a whiteboard, you can answer
almost anything about how this application is put together.

---

## Journey one: a landlord records a payment

The setup: rent arrived for Flat 1. The landlord opens the tenancy, clicks **Record a payment**,
types 6500, and submits.

### 1. The form, in the browser

**`src/app/landlord/leases/[leaseId]/payments/new/page.tsx`** is a server component. Before the
browser sees anything, it has already read the lease and built the rent schedule, so the month
select is pre-filled with the oldest unsettled period. It hands that to:

**`src/components/payments/RentPaymentForm.tsx`**, a client component. `react-hook-form` holds the
field values, and `zodResolver` validates them against
**`src/lib/validation/rentPaymentSchemas.ts`** as the landlord types. The schema is built with
today's date, because one of its rules is that money cannot arrive in the future.

If the amount is empty or the date is next week, this is where it stops, with no request made. That
is a convenience, not a defence.

### 2. The call

The submit handler calls `recordRentPayment(values)`. This looks like calling a function, and it is
one, but the function lives on the server: Next.js turns it into a POST to the current route with an
identifier for the action. Nothing about the shape of the data is chosen by hand.

### 3. Before the action, the proxy

**`src/proxy.ts`** runs first, because a server action is a request to a route and the matcher
covers it. It refreshes the Supabase session cookie and checks that a landlord is signed in. An
expired session is redirected to `/login` before the action executes at all.

### 4. The action

**`src/actions/rentPaymentActions.ts`**, in the seven steps every action in this project follows:

1. `requireLandlordProfile()` from **`src/lib/authentication/requireLandlordProfile.ts`**, which
   calls **`src/lib/authentication/getSignedInProfile.ts`**. That file verifies the token with the
   Auth service and reads the role from `profiles`. It is the only place the acting user is decided.
2. The same Zod schema parses the input again, built this time with the server's own date from
   **`src/lib/dates/currentDate.ts`**. This run is the trust boundary. The client's run could have
   been skipped entirely by anyone who wanted to.
3. The lease is read **as the landlord**. A lease belonging to someone else comes back as no rows,
   so it is refused with the same words as a lease that does not exist. Then
   **`src/lib/rent/isPeriodMonthWithinLease.ts`** checks the month falls inside the tenancy.
4. The insert. `landlord_id` and `recorded_by` come from the session, never from the form.
5. `revalidatePath` for the lease page, the dashboard, and the tenant's own pages.
6. An `ActionResult` goes back: success with the new payment's id.

### 5. The database has the last word

The insert reaches Postgres as the signed-in user, so `rent_payments_insert_own` is applied:

```sql
with check (
  landlord_id = (select auth.uid())
  and recorded_by = (select auth.uid())
  and public.current_profile_role() = 'landlord'
  and exists (select 1 from public.leases
              where leases.id = rent_payments.lease_id
                and leases.landlord_id = (select auth.uid()))
)
```

Every ownership check in step 3 is made again here, by the database, against a row it can see for
itself. The check constraints also fire: a positive amount, a period month that is the first of a
month, a received date that is not in the future.

**Say this part out loud at the whiteboard:** the action's checks produce good error messages. The
policy is what makes the write safe. If step 3 were deleted tomorrow, the write would still be
refused.

### 6. Back to the browser

The action returns, the client component navigates to the lease page, and because
`revalidatePath` ran, the server renders it fresh. The new payment appears in the history, the
schedule's status for that month changes on its own, and the tenant's own portal shows it too. **No
status was written anywhere.** It is derived, every time, by
**`src/lib/rent/deriveRentStatus.ts`**.

### The write in one breath

> The browser calls a typed function. Middleware refreshes the session. The action establishes who
> is acting from the cookie, re-runs the same validation the form ran, proves the lease is theirs,
> and inserts. Postgres applies the policy and the constraints. The page is revalidated, and the
> status nobody wrote appears.

---

## Journey two: a landlord opens the dashboard

The setup: the landlord signs in and lands on `/landlord`.

### 1. The proxy, again

**`src/proxy.ts`** verifies the session with `auth.getUser()`, reads the role from `profiles`, and
lets the request through because it is a landlord asking for the landlord area. A tenant here would
be redirected to `/tenant` before a single query ran.

### 2. The layout

**`src/app/landlord/layout.tsx`** calls `requireLandlordProfile()` again. The proxy has already
routed this request; the layout is the assertion that it did, and it is the check that would still
be standing if the routing rules were ever changed. It renders
**`src/components/layout/LandlordNavigation.tsx`** with the landlord's name as a prop, so nothing in
the browser has to ask who is signed in.

### 3. The page shell, immediately

**`src/app/landlord/page.tsx`** renders a heading and a `<Suspense>` boundary with a skeleton, then
streams. The reader sees the page frame at once rather than a spinner over everything.

### 4. The section fetches its own data

**`src/components/dashboard/DashboardOverview.tsx`** is an async server component. It makes **four**
database round trips, in parallel:

| # | Query | Shape |
| --- | --- | --- |
| 1 | `rent_collected_by_month` where month = this month | One row. A view that groups `rent_payments` by landlord and month, so the sum is Postgres's work |
| 2 | `lease_rent_summary`, all rows | One row per tenancy, each carrying the total received against it, already summed |
| 3 | `units`, `count: "exact"`, `head: true` | No rows at all, just the number |
| 4 | `maintenance_requests` not resolved, `count: "exact"`, `head: true` | The number again |

It was seven queries in the first draft. Query 2 now answers three of the five figures at once,
because one row per tenancy is all that is needed for what is overdue, how many units are occupied,
and which tenancies end soon. Two separate round trips for the last two were fetching rows already
on their way.

**Not one payment row is read.** A landlord in their first month and a landlord with three years of
history load the same amount of data.

### 5. Rules over aggregates

**`src/lib/rent/summariseOutstandingRent.ts`** turns each tenancy's total into arrears, and
**`src/lib/leases/describeLeaseLifecycle.ts`** says which tenancies are running. Both are pure
functions taking today's date as an argument.

The division is worth stating precisely, because it is the interesting design decision on this page:
**Postgres does what is proportional to the number of payments; the application does what is
proportional to the number of tenancies.** The arrears rule cannot go into SQL without writing the
rent schedule twice, in two languages, with nothing keeping the two in step.

### 6. Row Level Security, invisibly

Not one of those four queries has a `where landlord_id = ...` in it. The policies add it, and the
views are declared `security_invoker` so the policies underneath still apply to whoever selects from
them. A view without that would have been a hole straight through the authorisation model.

### 7. The browser

The section's HTML replaces the skeleton. Every figure is a link to the list behind it, so a number
that looks wrong is one click from the rows that produced it.

### The read in one breath

> The proxy proves who is asking. The layout asserts it again. The page renders immediately and
> suspends one section. That section makes four queries, three of them aggregates the database
> computed, and never touches a payment row. Pure functions turn those aggregates into what is
> owed. Row Level Security scoped every query without a single filter being written.

---

## The two shapes side by side

| | Write | Read |
| --- | --- | --- |
| Entry point | A client component calling a server action | A server component rendering |
| Who am I | `getSignedInProfile`, once | `requireLandlordProfile`, in the layout |
| Validation | The same Zod schema, twice | Not applicable |
| Database | One insert, policy and constraints applied | Four selects, policies applied |
| Afterwards | `revalidatePath`, then navigate | Streamed into a Suspense boundary |
| What is never done | Trust an id from the client | Add up rows in JavaScript |

## Three questions to expect

**Why is the validation run twice?** The client run is for the person filling the form; the server
run is the one that decides. They cannot disagree, because there is one schema.

**Why does the dashboard not just fetch the payments and add them up?** Because that cost grows
every month the product is used, and the growth is invisible until the day it is not. The database
adds; the application applies the rule.

**What would break if Row Level Security were switched off?** Everything, quietly. Not one query in
either journey filters by owner: the policies do it. That is the point, and it is why they are the
boundary and everything else is defence in depth.
