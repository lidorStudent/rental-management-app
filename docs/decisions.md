# Decisions Log

A running record of every technical decision in this project that is worth defending out loud.
Appended to at the end of every phase.

Each entry states what was decided, what the alternatives were, and why this one was chosen, in
three or four lines. The purpose is to make the project explainable under interview-style
questioning: if a choice cannot be justified here, it should not be in the codebase.

## Project links

| What | Where |
| --- | --- |
| Live application | https://rental-management-app-wine.vercel.app |
| Repository | https://github.com/lidorStudent/rental-management-app |
| Supabase project, production | `jarkqjrfuzvvrbietxve`, region `eu-central-1` |
| Supabase project, tests only | `attddpdrjaftdbgzlzmv`, region `eu-central-1` |

## Entries

### 2026-08-25 - Record payments rather than process them

Decided that the landlord records payments they have already received, and the product never holds
or moves money. The alternative was integrating a payment provider so tenants could pay in the app.
Processing money brings card data handling, refunds, chargebacks, payout timing, and financial
regulation, none of which addresses the problem being solved, which is a record-keeping failure.
Rent already arrives reliably by bank transfer; what is missing is the record of it.

### 2026-08-25 - Exactly two user roles, landlord and tenant

Decided against staff accounts, contractor accounts, an administrator role, and accountant access.
The alternative was a general role model that could be extended later. Every additional role
multiplies the permission cases that must be designed, enforced, and tested, and none of the four
problems in the product specification requires a third role for a landlord managing twenty units.

### 2026-08-25 - Rent status is derived, never entered

Decided that due, partial, paid, and overdue are computed from the payment ledger and the current
date. The alternative was a status field the landlord sets, which is simpler to build. A stored
status can disagree with the payments it claims to summarise, and that disagreement is exactly the
failure the product exists to remove. Derivation cannot drift.

### 2026-08-25 - No automated reminders in the first version

Decided that the product surfaces what needs attention when the landlord opens it, rather than
sending email or SMS. The alternative was automated overdue and lease-expiry notifications. Sending
on a landlord's behalf brings deliverability, opt-out, timing, and tone decisions that vary by
jurisdiction, and turns a record system into a communication system. The limitation is real and is
stated in the specification: the product informs a landlord who opens it.

### 2026-08-25 - A house is a property with one unit

Decided to model every dwelling as a unit inside a property, including a single-family house. The
alternative was letting a lease attach either to a property or to a unit. One uniform path means
one set of queries, one set of rules, and one shape to learn, at the cost of a slightly redundant
record for standalone houses.

### 2026-08-25 - The tenant portal reads the landlord's records directly

Decided that there is no share or publish action. The tenant's views read the same records the
landlord maintains, so recording a payment is publishing it. The alternative was an explicit share
step giving the landlord control over what the tenant sees. A second step is a step that gets
forgotten, and a landlord-controlled scope introduces the possibility of exposing the wrong
tenant's data. The scope of what a tenant may see is fixed by the product instead.

### 2026-08-25 - Postgres through Supabase, with Auth in the same instance

Decided on Supabase Postgres for both data and identity. The alternatives were a document database,
self-hosted Postgres with a separate auth provider, and Postgres with an ORM and a third-party
identity service. Only a setup where Auth and the database share an instance makes auth.uid()
readable inside a Row Level Security policy, which is what allows authorisation to live next to the
data instead of only in application code.

### 2026-08-25 - Row Level Security is the authorisation boundary

Decided that every table has RLS enabled and that queries run as the signed-in user, with the
application-layer ownership checks treated as defence in depth and the interface gating treated as
cosmetic. The alternative was enforcing ownership only in server actions, which is simpler to read
but fails the moment one query path forgets the filter. Putting the boundary in the database means a
forgotten check produces zero rows rather than another user's data.

### 2026-08-25 - Rent periods are derived, not stored

Decided that the rent schedule is computed from the lease's start date, end date, monthly rent, and
due day, and that payments reference a period by its month. The alternative was a rent_periods
table generated at lease creation. A stored schedule is a second copy of what the lease already
says and can disagree with it after any edit; deriving it makes the earlier decision that status is
never typed in structurally true, because there is nowhere to write a status even if someone wanted
to.

### 2026-08-25 - Money is stored as integer cents

Decided to store every amount as an integer number of minor units. The alternatives were a floating
point column, which cannot represent common decimal amounts exactly, and numeric(12,2), which is
exact in Postgres but arrives in JavaScript as a string that then needs parsing. Integers are exact
on both sides of the boundary and make the balance arithmetic in the ledger trivially correct.

### 2026-08-25 - The rent due day is capped at 28

Decided to constrain rent_due_day to the range 1 to 28. The alternative was allowing 1 to 31 and
clamping to the last day of short months at read time. Every month has a 28th, so the cap removes an
entire class of month-length bugs from the schedule generator at the cost of a rare and easily
explained restriction on data entry.

### 2026-08-25 - No lease status column, and overlap enforced by an exclusion constraint

Decided that a lease's lifecycle is derived by comparing today with its stored dates, and that the
no-overlapping-leases rule is enforced by a Postgres exclusion constraint over unit and date range.
The alternative was a status column plus an application-level check before insert. A status column
is a cached comparison that needs maintaining, and a read-then-write check is a race condition; the
constraint holds under concurrency and cannot be bypassed by any code path.

### 2026-08-25 - Tenant accounts are created by the landlord with a one-time temporary password

Decided that the landlord creates the tenant's account from the lease flow, the system generates a
temporary password and displays it once for the landlord to pass on however they normally talk to
that tenant, and the tenant must change it on first sign-in. The alternative was emailed invitations
through a transactional email service. This removes an external dependency and its cost, keeps the
project free to run, keeps the whole onboarding flow testable end to end in Playwright with no
mailbox to poll, and matches how a small landlord already communicates with their tenant. The
accepted cost is that there is no self-service password reset by email.

### 2026-08-25 - Rent statements are a print-optimised page, not a generated PDF

Decided to render the statement as an ordinary page with a print stylesheet and let the browser save
it as PDF. The alternative was a PDF generation library on the server. The browser already does this
well, the page stays accessible and linkable, and it avoids a dependency, a server-side rendering
path, and a second layout to keep in sync with the on-screen one.

### 2026-08-25 - Reads in server components, writes in server actions, and no route handlers

Decided that every read is a query inside a server component and every write is a server action, and
that the project has no route handlers at all. The alternative was an internal REST API under
/api that the client calls. There is no second client, no webhook, and no file download, so an API
layer would exist only to be called by our own pages, adding a serialisation boundary and a place
for authorisation to be forgotten.

### 2026-08-25 - No client state management library

Decided against Redux, Zustand, React Query, and a data-holding Context. The alternative is
conventional in React applications. Those libraries exist to keep a client-side copy of server data
correct, and this application has no client-side copy: server components read fresh data and
revalidatePath refreshes them after a write. Adding one would introduce the synchronisation problem
the product exists to remove.

### 2026-08-25 - landlord_id is denormalised, tenant assignment is not

Decided to carry landlord_id on properties, units, leases, rent_payments, and maintenance_requests,
while resolving tenant access through a subquery on the lease. The alternative was consistent
treatment of both. Ownership never changes during a row's life, so denormalising it keeps every
landlord policy a single equality with no join; tenant assignment does change, so copying it onto
child rows would create data that drifts.

### 2026-08-25 - The shadcn helper is named lib/classNames.ts

Decided to configure components.json so generated shadcn components import their cn helper from
lib/classNames.ts. The alternative was the default lib/utils.ts. A file named utils attracts
unrelated functions until it is a dumping ground; naming it for the one thing it does keeps that
from starting.

### 2026-08-25 - Deploy the empty scaffold before writing any feature

Decided to push a placeholder page to production as the last step of scaffolding, rather than after
the first feature. The alternative was deploying once there was something worth showing. A build
pipeline fails for reasons unrelated to the feature being built, so proving it works while the
project is one static page makes the next failure attributable to the code that caused it. It also
puts the graded live URL in place on day one.

### 2026-08-25 - vercel.json declares the framework

Decided to commit a vercel.json containing only the Next.js framework preset. The Vercel project was
created from the CLI before any code existed, so it defaulted to a static site and the first deploy
failed on an empty public directory. The alternative was changing the setting in the dashboard, which
leaves the repository unable to explain its own deployment; a committed file is visible and travels
with the code.

### 2026-08-25 - The folder skeleton is created only where files will live

Decided to create the structural directories from the technical plan now, each holding a .gitkeep,
and to let route directories under src/app appear with the pages that fill them. The alternative was
creating every planned route directory immediately. An app directory holding empty folders with no
page is decorative structure, and Next.js infers routes from files, so the folders would carry no
meaning until their pages arrive.

### 2026-08-25 - updated_at is maintained by a database trigger

Decided that every table carries updated_at and that a before-update trigger sets it. The
alternative was setting it in each server action, which is what most application code does. A
trigger cannot be forgotten by a new code path, and the column is only useful if it is true on
every row, so the guarantee belongs next to the data rather than in twenty call sites.

### 2026-08-25 - The profile row is created by a trigger on auth.users

Decided that inserting into auth.users creates the matching public.profiles row, reading role and
full_name from the signup metadata. The alternative was having the registration action insert the
profile after signing the user up. That is two writes across two systems with no transaction around
them, so a failure between them leaves an account that can sign in but has no role; the trigger
makes the pair atomic.

### 2026-08-25 - Row Level Security is enabled before any policy exists

Decided to enable RLS on all six tables in the schema migration, one phase before the policies are
written. The alternative was enabling it together with the policies. A table with RLS on and no
policy denies everything except the service role, so the window between the two migrations is
closed rather than open, and the safer of the two states is the one to be in by accident.

### 2026-08-25 - One timestamped migration per phase, applied to both projects by the CLI

Decided to keep migrations as timestamped files applied with supabase db push to the test project
first and then to production. The alternative was running SQL in the Supabase dashboard editor. A
statement executed in a dashboard exists in one project and in no file, which is how two databases
that are supposed to be identical stop being identical.

### 2026-08-25 - Tenant predicates are security definer functions

Decided that the tenant policies call helper functions such as is_current_tenant_lease, defined as
security definer with an empty search_path. The alternative was an inline EXISTS against leases in
each policy. An inline subquery is itself subject to the referenced table's policies, which couples
every policy to every other one and can recurse on profiles; running the predicate as the owner
removes that coupling, and each helper is scoped to auth.uid() internally so it grants nothing.

### 2026-08-25 - Every landlord policy tests the role as well as the owner

Decided that landlord policies require current_profile_role() = 'landlord' in addition to
landlord_id = auth.uid(). The owner test alone would already be sufficient for existing rows, but
an insert policy is checked against a row the client supplied, so without the role test a tenant
account could create a property naming itself as landlord. Gating the role in the policy means a
landlord-only operation is landlord-only in the database, not merely in the routing.

### 2026-08-25 - profiles.role is frozen by a trigger, not by a policy

Decided to block role changes with a before-update trigger. A policy decides which rows an
operation may touch, not which columns, so profiles_update_own must allow a user to update their own
row and therefore cannot by itself stop that user setting role to landlord. The alternative,
splitting the profile into two tables to make the column unwritable, adds a join to every session
lookup to solve a problem one trigger solves.

### 2026-08-25 - The seed is a Node script using the Auth admin API

Decided to write supabase/seed.ts rather than seed.sql. The alternative, inserting into auth.users
directly, means reproducing the password hashing and the internal columns of a schema owned by
another service; getting any of it wrong produces accounts that exist but cannot sign in. The script
also lets the seed be idempotent, target either project from an environment variable, and refuse to
run against production without an explicit flag.

### 2026-08-25 - The role is read from the profiles table, never from the token

Decided that both the proxy and getSignedInProfile read the role out of public.profiles, at the cost
of one primary-key lookup per request. The alternative was reading it from the JWT's user metadata,
which is free because the token is already decoded. A signed-in user can rewrite their own user
metadata through the Auth API and cannot rewrite their profile row, so the free answer is the one an
attacker controls. For the same reason every check uses auth.getUser(), which verifies the token
with the Auth service, rather than auth.getSession(), which only decodes the cookie.

### 2026-08-25 - There is no public landing page

Decided that every route requires a session except /login and /register, with / redirecting rather
than describing the product. The alternative was a marketing-style landing page, as the technical
plan first assumed. A landing page is a second public surface to reason about for a product nobody
discovers by browsing: every user either registers as a landlord or is handed an account.

### 2026-08-25 - Email confirmation is off, and the password policy lives in config.toml

Decided to disable email confirmation on both Supabase projects and to require ten characters with
mixed case and a digit, pushing both settings from supabase/config.toml with supabase config push.
Confirmation had to go because there is no email service in this project, so a landlord who
registered could never confirm and never sign in. Putting the policy in config.toml rather than
clicking it in the dashboard keeps the two projects identical and keeps the setting in the
repository, where the Zod schema that mirrors it can be read next to it.

### 2026-08-25 - The service role client is fenced off with the server-only package

Decided to add the server-only package and import it at the top of adminClient.ts, temporaryPassword
and the authentication helpers. The alternative was relying on discipline and code review. Importing
one of those files into a client component is now a build error rather than a leak nobody notices,
which is the right failure mode for the one key that bypasses Row Level Security.

### 2026-08-25 - The middleware file is src/proxy.ts

Decided to use Next.js 16's proxy file convention rather than the deprecated middleware one, and to
place it inside src/ because that is where Next looks in a project with a src directory. The build
warns about the old name, and the first attempt at this phase put middleware.ts in the repository
root, where Next silently ignored it and every guard appeared to pass while protecting nothing.

### 2026-08-25 - The Next.js agent block in CLAUDE.md is committed

Decided to commit the nextjs-agent-rules block that next dev appends to CLAUDE.md. The alternative
was deleting it after each run. The generator re-adds it every time the dev server starts, so
deleting it produces a permanently dirty working tree; committing it keeps git status meaningful.

### 2026-08-25 - A lease occupies both of its endpoint dates

Decided that a lease ending on the 31st still owns the 31st, so the next tenancy on that unit may
start no earlier than the 1st. The alternative was an exclusive end date, where a handover day
belongs to the incoming tenant. The inclusive rule matches the leases_no_overlap exclusion
constraint already in the database, and the outgoing tenant is paying rent for a month that includes
that day. The decision was confirmed by the project owner when the phase instruction and the shipped
constraint disagreed.

### 2026-08-25 - Calendar dates are YYYY-MM-DD strings, never Date objects

Decided that every business rule handles dates as text. The alternative was Date objects, which is
what most JavaScript code does. A rent due date is a calendar fact rather than an instant, and a
Date carries a time and a timezone that can silently move it across a day boundary. The format also
sorts chronologically as text, so the overlap and overdue rules compare with < and <= and parse
nothing.

### 2026-08-25 - Money is parsed from text, never multiplied as a float

Decided that parseCurrencyInputToCents reads the digits and assembles an integer number of agorot.
The alternative, Math.round(amount * 100), is one line shorter and wrong: 6500.10 * 100 is
650009.9999999999 in JavaScript. A ledger that is out by an agora is a ledger a tenant can argue
with, which is the opposite of what the product is for.

### 2026-08-25 - The rent payment schema is built, not exported

Decided that buildRecordRentPaymentSchema takes the current date and returns a schema, because the
rule "a payment cannot have been received in the future" needs to know what today is. The
alternative was calling new Date() inside the schema, which would make that one rule untestable on
any day but today and would break the promise that no rule in this codebase reads the clock.

### 2026-08-25 - Email is normalised; there is no phone number to normalise

Decided that every email field is trimmed and lowercased, so that one tenant cannot end up with two
accounts spelled differently, matching how Supabase Auth stores addresses. There is no phone number
anywhere in the data model: the product records tenancies and money, and the landlord passes a
temporary password on through whatever channel they already use. Adding a phone column would be a
migration and a new field on a form, not a normalisation rule.

### 2026-08-25 - Actions return a result; they never redirect

Decided that every landlord action returns an ActionResult carrying the identifier the caller needs,
and that navigation is the calling component's decision. The technical plan originally had several
of them redirecting. A redirect inside an action throws a control-flow exception, which makes the
action awkward to call from anywhere but the one form it was written for, and impossible to assert on
in a test without rendering a page.

### 2026-08-25 - A lease is ended or renewed, never edited

Decided against a general updateLease. Ending brings the end date forward and changes nothing else;
renewing writes a new lease on the same unit for the same tenant. The alternative was one action
that re-writes every field. A lease is a record of what was agreed, and a form that re-types the
rent on a running tenancy invites exactly the quiet rewriting of history the ledger exists to
prevent. The cost is real and recorded as a limitation: a lease typed in wrongly cannot be removed.

### 2026-08-25 - Action parameters are the schema's input type, not its output

Decided that every action's parameter type is z.input<typeof schema>, because a form holds the text
a person typed and the schema is what turns "6,500.50" into 650050 agorot. Using z.infer, which is
the output type, compiled while describing a shape no caller could actually produce. The action's
parsed.data is the output type, and the difference between the two is where the parsing happens.

### 2026-08-25 - Counting dependants before a delete is a message, not a guarantee

Decided that deleteProperty and deleteUnit count the leases that would be orphaned and refuse with a
sentence naming the number. The guarantee is still the on delete restrict foreign key: the count is
read as the acting landlord, so it is subject to Row Level Security, and a landlord probing somebody
else's unit sees a count of zero. That does not matter, because the delete that follows is refused by
the same policies, which is the point of putting the boundary in the database.

### 2026-08-25 - A tenant confirms a resolution, in one column

Decided to add tenant_confirmed_at to maintenance_requests, so the record of a fixed problem carries
the word of the person standing in the flat rather than only the landlord's. The alternatives were
leaving resolution entirely to the landlord, which is what the plan had, or a comment thread, which
the product specification rules out because a thread is how maintenance became unfindable in the
first place. Any status change clears the confirmation, because a request that was reopened is not
one the tenant agreed was finished.

### 2026-08-25 - The confirmation is guarded by a policy and a trigger, not a policy alone

Decided that maintenance_requests_confirm_as_tenant decides which rows a tenant may update, and
maintenance_requests_tenant_confirms_only compares every other column and refuses if anything else
moved. A policy restricts rows and never columns, so on its own it would have let a tenant rewrite
the title of their own resolved request. Column-level grants cannot help, because the landlord and
the tenant are the same database role. This is the same shape as profiles_role_is_immutable, which
is already in the schema for the same reason.

### 2026-08-25 - A tenant without an active tenancy gets a sentence, not an error

Decided that submitMaintenanceRequest answers "no tenancy recorded yet", "your tenancy starts on X"
or "your tenancy ended on X" rather than throwing. A tenant whose lease has ended is an ordinary
state, not a fault: the product specification requires their history to stay reachable, and an
error page would tell them something has broken when nothing has.

### 2026-08-25 - The two areas have separate navigations

Decided on LandlordNavigation and TenantNavigation rather than one component with a list of links
passed in. They are not the same component wearing different labels: the landlord's is four
destinations they visit several times a week, and the tenant's is three, seen a few times a year by
someone who has forgotten the product exists. Sharing them would mean every later change to one
having to be reasoned about for the other.

### 2026-08-25 - The paginated table is a server component and the page number lives in the URL

Decided that PaginatedTable receives already-fetched rows and renders its controls as links, so the
page number is a query parameter the server reads on the next request. The alternative was a client
table holding the page in state and fetching as the reader moves. Nothing in this product fetches
from the browser, and a page in the URL can be linked, bookmarked and reloaded, which a page in a
component's state cannot.

### 2026-08-25 - A page number past the end sends the reader back to the first page

Decided that a list page detects PostgREST's PGRST103 and redirects to page one. PostgREST refuses a
range starting past the last row and returns no count with the refusal, so the table would otherwise
show its empty state and tell a tenant with a payment history that they have none. This was found by
asking for page 99 of a three-row list.

### 2026-08-25 - Form fields take what register returns

Decided that TextField, TextAreaField and SelectField accept the props react-hook-form's register
produces and forward them to the input, rather than reading the form through a context. The
alternative, useFormContext inside each field, needs the form's type at every call site and hides
where the field state comes from. Spreading register keeps the call site one line and the wiring
visible.

### 2026-08-25 - Selects are the browser's own

Decided to use a native select for the closed lists that come from database enums, rather than the
shadcn select built on a Radix popover. The lists are three to five words long, the native control
is denser, and it works with a keyboard and on a phone with nothing added. A custom listbox would be
more code to explain for a control nobody will notice.

### 2026-08-25 - Occupancy is derived from tenancies, never stored on the unit

Decided that whether a unit is let is worked out from its leases every time it is shown, by
describeUnitOccupancy. The alternative was an is_occupied column updated whenever a lease is written.
A flag is a cached answer that something has to remember to update: end a tenancy early and it is
wrong, record one starting next month and it is wrong, and nothing tells you it is wrong. The leases
already hold the answer. It is the same reasoning that keeps rent status and lease lifecycle
derived.

### 2026-08-25 - Deleting takes two steps and states the consequence

Decided that a delete control reveals a panel naming exactly what goes with the record, then asks
again. The alternative was window.confirm, which cannot say anything specific, cannot be styled, and
cannot be exercised by a browser test. The panel also does the arithmetic in advance: it says how
many units a building would take with it, and it disables the confirmation outright for a unit that
has tenancies, so the refusal is visible before anything is clicked.

### 2026-08-25 - Buildings are paginated, units are not

Decided that the property list uses the paginated table and the units inside a property do not. A
rent ledger and a maintenance list grow for as long as a tenancy lasts, and a portfolio grows as a
landlord buys; the units in one building are fixed by the building. Page controls under a table of
three rows are furniture, not function.

### 2026-08-25 - The overlap refusal names the earliest date that would work

Decided that a rejected lease is told which tenancy is in the way, with its dates, and the first day
the unit is free: "already let from 2025-12-01 to 2026-12-31, so a new one can start on 2027-01-01 at
the earliest". The alternative was reporting that the dates overlap. This rule is the one a landlord
is most likely to hit and least likely to have thought about, because the end date belongs to the
outgoing tenant, and a refusal that does not say what to do instead is a refusal they will argue
with.

### 2026-08-25 - Forms validate with the schema but submit what was typed

Decided to build every resolver with zodResolver(schema, undefined, { raw: true }). The schemas
transform: "6,500.50" becomes 650050 agorot. Without raw, react-hook-form would hand the submit
handler the transformed values and the action would then be parsing numbers with a schema that
expects the text a person typed. The client validates, the server parses, and the value that travels
between them is the one from the input.

### 2026-08-25 - The unit's occupancy is shown while the tenancy is being written

Decided that choosing a unit on the new lease form shows what that unit is currently doing and
until when, from data the server sent with the page. The alternative was letting the landlord find
out by being refused. The two commonest mistakes here are letting a flat that is already let and not
knowing when the current tenancy ends, and both are answered before the form is submitted.

### 2026-08-25 - Rent totals are summed by Postgres, in security_invoker views

Decided to add lease_rent_summary and lease_period_totals, two views that group rent_payments, and to
read those from the screens instead of the payments. The alternative was fetching a tenancy's
payments and adding them up in JavaScript, which works on day one and gets slower every month the
product is used. The views are declared security_invoker so the policies on the tables underneath
still apply to whoever selects from them; a view without that would return everybody's ledger.

### 2026-08-25 - Postgres adds the rows, the application applies the rule

Decided that the arrears calculation stays in TypeScript even though the totals come from SQL. The
alternative was computing outstanding rent in the view. Outstanding depends on the rent schedule,
and the schedule is derived from the lease rather than stored, so putting it in SQL would mean the
same rule written twice in two languages with nothing keeping them in step. The database aggregates
what is proportional to the payments; the rule runs over one row per tenancy.

### 2026-08-25 - A total is allocated to the oldest unpaid month first

Decided that where only a lease total is available, as on the rent overview, it is applied to the
oldest period first. That is what a ledger does anyway: money that arrives settles the oldest
arrears. The lease page does not need the assumption, because lease_period_totals says exactly how
much arrived for each month.

### 2026-08-25 - Credit on one tenancy is not netted against arrears on another

Decided that the portfolio total adds up arrears only. A tenant who paid next month early does not
reduce what a different tenant owes, and a headline figure that pretended otherwise would be the
wrong number to act on. Credit is still shown, per tenancy, where it belongs.

### 2026-08-25 - The dashboard makes four round trips, not seven

Decided that one query for lease_rent_summary answers three of the five dashboard figures: what is
overdue, how many units are occupied, and which tenancies end soon. The first draft had a separate
query for the occupied unit count and another for the tenancies ending soon, both of which were
re-reading rows already on their way. Counting the round trips is what made that visible; the
figures themselves did not change.

### 2026-08-25 - Occupancy is counted by counting active tenancies

Decided that the number of occupied units is the number of tenancies that are running today. That is
only true because the exclusion constraint makes two overlapping tenancies on one unit impossible,
which is worth saying out loud: a constraint in the database is what lets a count in the application
be correct without a distinct.

### 2026-08-25 - Illegal status moves are not rendered and are also refused

Decided that MaintenanceStatusControl builds its buttons from allowedStatusTransitions, the same
constant updateMaintenanceRequestStatus checks against. Rendering only the legal moves means the
interface cannot express an illegal one. Refusing them in the action as well means a control that is
not rendered is not being relied on as a rule, which is the same reasoning as the rest of this
project.

### 2026-08-25 - A tenant may read their own landlord's contact details

Decided to add profiles_select_landlord_of_own_lease, so the tenant portal can show who to contact.
The landlord has been able to read their tenant's profile since the first policy migration, and the
other direction was simply missing. It is the narrowest form of the rule: it answers for the profile
named as landlord on a lease this tenant is the tenant of, and for no other profile. Verified by
signing in as a tenant and finding exactly two profiles visible, their own and their landlord's.

### 2026-08-25 - No tenant page takes an identifier from the URL except one

Decided that the tenant portal resolves the tenancy from the session, in loadTenantLease, rather
than from a lease id in the address. The only tenant route carrying an identifier is a single
maintenance request, and it is not checked against the session by hand: the query runs as the tenant
and the policy returns nothing for somebody else's request, which the page answers with the same
not-found response as an identifier that matches nothing. Verified in a browser: the two pages are
byte for byte identical.

### 2026-08-26 - The statement reads the ledger, not the aggregate views

Decided that the statement queries rent_payments directly, unlike the dashboard and the rent
overview which read summed views. The alternative would have been consistent but wrong: a statement
exists to be checked line by line against a bank record, so it has to list the payments themselves,
and its range bounds how many there are. The rule elsewhere is that no screen sums an unbounded
table; this one sums a bounded one and shows its working.

### 2026-08-26 - The tenant's statement route carries no lease id

Decided that /tenant/statement takes only a month range, and resolves the tenancy from the session
like every other tenant page, while the landlord's statement takes the lease id in the path. A
tenant asking for another tenancy's statement is therefore not a request the route can express,
rather than one it has to refuse. A tenant with more than one tenancy can only produce a statement
for the current one, which is the accepted cost.

### 2026-08-26 - A nonsense month range falls back instead of failing

Decided that chooseStatementRange clamps both ends inside the tenancy, swaps a range that reads
backwards, and ignores values that are not months. Someone editing the address bar, or following a
bookmark to a range the tenancy no longer covers, gets a sensible statement rather than an error
page or an empty document that looks like a fault.

### 2026-08-26 - Tests live beside the code they test

Decided that a unit test sits next to its module as findConflictingLease.test.ts, rather than in a
mirrored tests directory. The alternative keeps the source tree tidier and makes it easy to add a
module and forget its test; with the pair side by side, a module without one is visible at a glance.
End-to-end tests stay in e2e/, because they belong to a journey rather than to a file.

### 2026-08-26 - Component tests mock the server actions and nothing else

Decided that a form's test replaces the server action with a stub and asserts on what the reader
sees: the fields, the messages, and what the form sends. The action itself cannot run in a test
process, because it imports server-only modules by design. Nothing else is mocked, so the schema,
the resolver and the rendering are all the real ones.

### 2026-08-26 - Optional text fields accept the null the database holds

Decided that optionalTextField treats null, undefined and an empty string as the same absence, after
a test of the correction schema passed a null reference straight from a payment row and was told it
was the wrong type. Two spellings of nothing were already collapsed into one; the third had been
missed. The test was left alone and the field schema was fixed.

### 2026-08-26 - The function length limit does not apply to test files

Decided to switch max-lines-per-function off for test files. A describe block is a list of tests
rather than a function anyone has to hold in their head, and splitting one to satisfy a limit would
scatter related cases for no reader's benefit. Every other rule, including the forbidden
abbreviations, still applies.

### 2026-08-26 - The permission tests attack the database, not the interface

Decided that every authorisation test signs a real user in and queries the tables directly, with the
same public key their browser holds. The alternative was driving the interface and asserting that
somebody else's data is not on screen. An interface test would keep passing with every policy
dropped, because the pages would go on hiding what they always hid. Only a test that asks the
database can fail when the boundary fails.

### 2026-08-26 - The database suite is a separate command

Decided on tests/ with its own vitest configuration and an npm run test:db script, rather than
folding these into npm test. The unit suite stays offline and finishes in three seconds; this one
needs a network, a seeded project and about twenty. Keeping them apart means the fast one is run
constantly and the slow one is run deliberately.

### 2026-08-26 - The suite refuses to run against production

Decided that testDatabase.ts compares the project reference against the production one and throws
before building a single client. These tests sign users in and write rows: pointed at the deployed
project they would put test tenancies into a real portfolio. The guard was tested by pointing
.env.test at production on purpose and watching it refuse.

### 2026-08-26 - Refusals are proved alongside permissions

Decided that the same suite performs every operation successfully as the rightful owner. A suite of
refusals alone would be passed by a database that refuses everything, which would be perfectly
secure and completely useless. The positive control is what makes the refusals evidence.

### 2026-08-26 - Every browser test builds its own portfolio and removes it

Decided that an end-to-end test creates its own landlord, building and tenants through the admin API,
then deletes all of it afterwards, rather than acting on the seeded portfolio. The alternative shares
one dataset between tests, which makes them depend on each other's order and on what the last run
left behind. The suite now passes three times in a row from a seeded database and leaves the seed
counts exactly as it found them.

### 2026-08-26 - Set-up goes through the API, not through the interface

Decided that a test only drives the interface for the thing it is testing. Building a portfolio
through the screens before testing the tenant portal would make the tenant tests fail whenever a
landlord form changed, which is a test reporting the wrong thing.

### 2026-08-26 - The navigation wraps on a narrow screen

Decided to let both navigations wrap their links. The manual layout check found that at 375 pixels
the landlord's five links pushed the whole page sideways by ten pixels, because the row could not
wrap. That is exactly the class of defect a person notices in a second and an assertion would not,
which is why that check is on the manual list.

### 2026-08-26 - A field's error is announced with the field

Decided that every field points at its own error message with aria-describedby, alongside the hint
where there is one. The message had been rendered under the input and associated with nothing, so a
screen reader announced the label and "invalid data" and never said what was wrong. It was found by
running the manual screen reader check, which is the reason that check is on the list: no assertion
in the suite noticed, because the message was on the page and visible. It is asserted now, through
the accessible description of a field, in all three field types.

### 2026-08-26 - There is exactly one route handler, and it queries the database

Decided that /api/health is a route handler rather than a page, and that it makes a real query
rather than answering statically. The rule recorded in the technical plan is that a route handler
exists when something other than our own React tree speaks HTTP to us, and a scheduled workflow is
exactly that. It queries because the point is to keep the Supabase project from being paused for
inactivity, and a static answer would keep Vercel warm while the database went to sleep. It is the
only path the proxy lets through unauthenticated, and it returns no data at all.

### 2026-08-26 - No external uptime monitor

Decided against a third layer. The daily workflow runs against a seven-day pause window, so it would
take a week of consecutive missed runs to matter, and GitHub only disables scheduled workflows in a
repository with no activity for sixty days. A monitor would add an account, a browser signup and
another thing to explain, for a risk the workflow already covers. If the project were ever to sit
untouched for two months, that is the decision to revisit.

### 2026-08-26 - The deployment smoke check is read only and opt in

Decided that e2e/deploymentSmoke.spec.ts skips unless PLAYWRIGHT_BASE_URL names an address, and that
it only reads. It runs against the project real people are shown, so it signs in as the seeded
accounts and looks at pages rather than creating a portfolio the way the rest of the browser suite
does. Keeping it in the repository rather than typing it out after each deployment means the check
after a deployment is the same check every time.

### 2026-08-26 - The session cookie is made HTTP-only, against the library's default

Decided to override the cookie flags @supabase/ssr writes, in
src/lib/supabase/sessionCookieOptions.ts, so the session cookie is httpOnly, sameSite lax, and
secure in production. The library deliberately leaves that cookie readable by page JavaScript,
because its browser client hydrates the session from document.cookie. This project has no such
client: every read happens in a server component and every write in a server action, so the session
is only ever read on the server. Leaving it readable was paying an XSS cost for a feature never
used, and the cookie holds the refresh token as well as the access token, so one injected line could
have kept a session alive long after the page was closed.

The trade-off is that a client component can no longer read the session, which is why
createSupabaseBrowserClient was deleted rather than left as a client that cannot work. Anything
needing session-aware behaviour in the browser now has to be handed what it needs as a prop from a
server component, which is how the rest of this application already works. It was found by checking
the real cookie on the deployed site while writing the security document, after two documents had
already claimed the flag was set; both were corrected.


### 2026-08-26 - The scale document was measured rather than reasoned, and the two defects it found were left for their own phase

Decided to build synthetic portfolios in the test project, time the real queries against them as an
ordinary signed-in user, and write docs/06-scale.md from those numbers. The alternative was to
reason from the schema, which is what a scale document usually is. Measuring found two things
reasoning had missed: the row-level security on rent_payments cannot be answered from an index, so a
query that supplies no filter of its own reads the whole table (566 ms against 100 ms for the same
288 rows), and the deployed functions run in Washington while the database is in Frankfurt.

Decided to record both as findings with their measurements rather than fix them in a documentation
phase. The tenant payment list and the dashboard's collected-this-month read are two-line changes
with measured before and after figures; lease_rent_summary needs its definition changed and a
measurement of its own. Changing behaviour while writing the document that describes the behaviour
would leave the document describing something that was never tested.

### 2026-08-26 - The presentation deck is HTML printed to PDF by Playwright's Chromium

Decided to build docs/presentation.pdf from an HTML file rendered by the Chromium that Playwright
already installs for the end-to-end tests, in scripts/buildPresentation.mjs. The alternatives were
Keynote or PowerPoint by hand, which produces a file nothing in the repository can rebuild, and
python-pptx, which is a new dependency in a second language for one artifact. This way the deck is
generated from a script that lives next to the code, the two diagrams are the same SVG files the
documents link to, and rebuilding after a change is one command.

The cost is that a PDF cannot be edited slide by slide the way a .pptx can: a correction means
editing the script and rebuilding. That is the right trade for a deck whose content comes from
docs/09-presentation-script.md, which is itself in the repository. One detail worth remembering:
each slide is 719 pixels tall rather than 720, because at exactly the page height Chromium spills
every slide onto a second, empty page.

### 2026-08-26 - The scale document's mechanism was confirmed with a query plan, not left inferred

Decided to take real plans with `supabase db query --linked`, under `set local role authenticated`
and the token claims a signed-in landlord arrives with, and to quote them in docs/06-scale.md. The
document had said no plan could be taken because the CLI only applied migrations. That was simply
wrong, and the audit caught it: `supabase db query` runs arbitrary SQL through the Management API
and asks for no database password.

The plans say what the timings had suggested: relying on the policy alone gives a sequential scan of
the whole rent_payments table with 7,229 rows discarded, while the same count with an explicit
landlord filter gives an index scan of the reader's own 288. The lease_rent_summary plan shows the
scan and the grouping happening inside the view, which is why a filter at the call site cannot help
it and the view itself has to change.

### 2026-08-27 - The interface has one design direction, and status is coloured by meaning

Decided to give the product a deliberate visual identity rather than the shadcn starter's greyscale,
and to do it entirely with design tokens and the components already in the repository. Nothing was
added to `package.json`: no icon set, no chart library, no component kit, no CSS framework beyond the
Tailwind already there. The whole direction lives in `src/app/globals.css`, and the components that
consume it changed only their class attributes. The alternative - reaching for a component library
to make it look designed - would have added a dependency to justify in an interview and a second
opinion about how things should look, in a project whose point is that every line can be explained.

The direction itself is restrained: neutral surfaces with a single blue accent carrying everything
interactive - the primary button, the focus ring, the hover wash - five type roles with a class for
the two that repeat, and one spacing rhythm, with table density set once in `ui/table.tsx` rather
than per table. Bordered surfaces follow one rule: anything carrying data or offering an action of
its own is a white well on the grey page, while notes, warnings and page controls sit flush. A
back-office console is looked at for hours by one person, so the goal was quiet and scannable, not
striking.

The larger decision is status colour. This product has three status systems - rent, maintenance and
lease lifecycle - and twelve words between them, and each of the three badge components used to
carry its own Tailwind palette colours. They had already drifted: an overdue month and a reported
problem nobody has looked at are the same thing to a landlord, and were being painted differently
because two people-hours apart had picked two different reds. The twelve words collapse into five
meanings - neutral, progress, settled, attention, critical - and a meaning becomes a colour in
exactly one place. Each badge component now names a meaning. That is one table to reason about
instead of twelve strings in three files, and it makes the product's own model visible: a landlord
learns five colours once and reads all three systems.

The five meanings are also five amounts of ink: dashed outline, solid outline, tint, heavier tint
with more weight, and one solid fill for critical. That ladder is the point rather than a flourish.
Colour alone fails in greyscale, on a projector, on a printed statement and for a reader who cannot
separate red from green, so the badges had to stay apart with the colour taken away. Measured on the
deployed site, the five backgrounds come out at 1.000, 1.000, 0.905, 0.842 and 0.089 in relative
luminance, the first two separated by border style and weight, and print media matches screen
because the badge carries `print-color-adjust: exact`. Critical is the only filled badge, which is
what makes an overdue row findable at a glance in a full table.

Doing this turned up a real bug that had nothing to do with colour. `@theme inline` mapped
`--font-sans` to `var(--font-sans)`, a self-reference, so the custom property was invalid at
computed-value time and `html { font-family: var(--font-sans) }` fell back to the browser's default.
Every page had been rendering in Times New Roman while the root layout loaded, and paid for, the
Geist it was supposed to use. It now points at `--font-geist-sans`, the variable the layout actually
defines, and the deployed site computes `Geist, "Geist Fallback"`. Worth remembering as the reason
to check a computed style rather than trust that a declaration was written.

The `.dark` block keeps a value for every new token, because that is the contract the file already
had, but nothing in the product sets the class. Dark mode remains unbuilt rather than half-built.

### 2026-08-27 - The form controls became one control, and the accent marks where work starts

Decided that the three field components stop having three appearances. `TextField` rendered the
shadcn `Input` at 32px with a 12px radius and no shadow, while `SelectField` and `TextAreaField`
were hand-rolled at 36px with a 9.6px radius and a shadow, so on the tenancy form the unit select
was visibly chunkier and squarer than the date fields beneath it. They now agree on height, radius,
padding and background, which meant editing `ui/input.tsx` rather than passing overrides from
`TextField`: the primitive is used by exactly one component, and correcting it there keeps the
override out of every future call site.

Giving all three a card background is the same rule the tables already follow. A form screen had no
white surface anywhere, so its fields sat on the page grey and read as sunken. The three now also
share one focus transition, so the ring behaves identically whichever control the reader is in.

Decided too that the single accent marks the action that starts the work on a screen. It was
appearing only on form submits, so "Add a property", "Record a tenancy" and "Record a payment" -
the reason a landlord opens those pages - were outline chips indistinguishable from secondary
controls, while "Create the tenant account", used once in a tenancy's life, was the loudest thing on
the lease. `SubmitButton` gained a variant for that one case rather than a class override, because
the emphasis is what is being chosen and a variant is what shadcn calls that choice.

A defect was reported against the primary button's focus ring and there was none. The first
measurement read `box-shadow` at the instant of focus, before the button's `transition-all` had
drawn it. The lesson is the one this project keeps relearning: measure the rendered result, and
measure it after it has settled. The keyboard pass was re-run properly across both portals - 201
focus stops, 198 with a visible indicator, the other 3 being the calendar button Chromium puts
inside a date input, which no application style can reach.

### 2026-08-27 - The functions moved to Frankfurt, and that retired the next optimisation

Decided to pin `"regions": ["fra1"]` in `vercel.json`. The deployed site reported
`x-vercel-id: fra1::iad1`: requests entered Vercel in Frankfurt and executed in Washington, while
both Supabase projects are in `eu-central-1`. Every round trip crossed the Atlantic, and there are
four before a page does any work of its own, because the proxy reads the session and the layout
reads it again, and Next 16 runs the proxy in the Node runtime beside the pages rather than at the
edge. The alternative was to attack the number of round trips instead, which is the harder and more
dangerous half of the same problem.

Measured after: the health check went from 647 ms to 338 ms, the median page's server time fell 66%,
and the deployed smoke suite went from 26.1 s to 14.5 s. The account is on the Hobby plan, which
allows one region; that was confirmed on a preview deployment before production saw it.

The interesting part is what it did to the next item on the list. Three pages issued two independent
reads one after the other, and running them together halves the pair - measured at 177 to 86 ms, 167
to 88 ms and 176 to 90 ms from a machine 85 ms from the database. That change was written, deployed,
and then reverted, because the saving is exactly one round trip and one round trip inside the region
is no longer measurable: three pages differing only in whether they make one query of their own
measured 259, 259 and 254 ms across 36 samples each, a gap of 0 ms and -5 ms against a spread of
about 20 ms.

Worth remembering as a rule rather than as a fact about this project: fix the latency first, because
it decides whether reducing the number of round trips is worth anything at all. Had the order been
reversed, three files would have been changed, a `notFound()` guard would have moved behind a comment
explaining why that was still safe, and the measured gain would have been zero.


### 2026-08-28 - Two profile columns are pinned against their owner, and the site sends a policy

Decided to close the two findings an adversarial review could actually exploit, and to leave the
rest of what it found written down rather than quietly fixed.

`profiles_update_own` let an account write its own row, which is right, and was two columns too
broad. `must_change_password` is what the proxy reads to hold a tenant on the change-password page,
and it sat on the tenant's own row: one PATCH cleared it and the tenant walked into the portal with
the landlord's temporary password still active. `email` is what the landlord reads to make contact,
and is only a copy of the address in `auth.users`, so a tenant could leave their landlord looking at
an address that reaches nobody. A `BEFORE UPDATE` trigger in the shape of the
`prevent_profile_role_change` sitting three lines above it refuses both, and lets the service role
through the way `restrict_tenant_maintenance_update` does. The alternative was a narrower policy,
which would have meant editing the policy set that ninety-odd attack attempts had just failed
against; a trigger adds a rule without touching one.

`full_name` was deliberately left writable and DB-25 asserts it, because a test that asserts a
non-restriction is the only way that reads as a decision rather than as an omission.

The fix broke a flow before it fixed anything: `changePassword` cleared the flag with the tenant's
own session, so the trigger would have trapped every new tenant on the change-password page forever.
It now clears it through the admin client, pointed at the id the verified session resolved. That
makes a second caller of the service role, which the security document now says.

The content security policy carries `'unsafe-inline'` on `script-src`. Next streams its payload as
two inline script blocks, so the choice was that or a per-request nonce, and a nonce has to be
generated in the proxy - the file it is least sensible to complicate nine days out. It is written
down in three places rather than buried: the config comment, the security document, and here. What
survives the trade is worth having: nothing can be loaded from another origin and `connect-src
'self'` means an injected script has nowhere to send anything.

The lesson worth keeping is about the verification, not the fix. Testing the policy against a local
production build looked safe and was not: `next start` serves a build with `.env.local` baked in, so
the check ran against production and its form submit wrote a row there, which had to be found and
removed. `next dev` reads the environment at runtime and had made every earlier check safe. The two
are not interchangeable when the environment decides which database you are pointed at.


### 2026-08-28 - The anonymous role may read and may not write

Decided to revoke `insert`, `update` and `delete` from `anon` on every table in the public schema,
so that an anonymous write is refused by the grant before any policy is consulted. The alternative
was to leave it, on the grounds that Row Level Security already refuses those writes, which it
demonstrably does. The reason not to leave it is that it was safe on one mechanism: a table added one
day without a policy would have been world-writable the moment it existed, and nothing else in the
system would have objected.

It is defence in depth and the document says so rather than overstating it. Before the revoke, an
anonymous update returned no error and changed nothing, because no row was visible to change. After
it, the same attempt is refused outright. No attack is stopped that was not already stopped.

`select` stays granted, because `/api/health` reads a count with no session at all so a free-plan
project is not paused, and the policies answer that read with nothing. `authenticated` keeps its
write grants: every legitimate write is made by a signed-in user through the session-carrying client,
so revoking them would not add a layer, it would remove the only path the application has.

Before writing any of it, the claim that nothing writes as anon was re-proved rather than assumed:
all seventeen writes in the codebase live in `src/actions`, every one resolves the acting user first,
fifteen go through the session-carrying client and two through the service role. Registration is the
one flow with no session that still makes a row appear, and that row is inserted by a security
definer trigger on `auth.users` running as its owner, which was tested against the revoked project
before production was touched.

Two things worth remembering came out of the verification rather than the change. An `update({})`
with an empty payload is a no-op that PostgREST never sends, so a test written that way passes
whether or not the grant exists - the first draft did exactly that and looked like a pass. And the
generated database types make the table name in an `it.each` loop a union, which types every insert
column as `never`, so the per-table claim is carried by update and delete, which are also the pair
that actually discriminates: before the revoke they returned no error, while insert was already
refused by the policy.


### 2026-08-28 - truncate goes too, and the local policy stays identical to the shipped one

Two decisions, both about not leaving something half done.

`truncate` was left out of the first revoke on the reasoning that PostgREST exposes no verb reaching
it. That reasoning was thin, and it was exactly the wrong grant to reason loosely about. A policy
restricts which rows a statement sees; `truncate` does not look at rows, so unlike `delete` Row Level
Security does not filter it at all. Of everything `anon` held, it was the only write with no backstop
underneath it. It is revoked now, on both projects and on the default privileges.

Proving that took a new object, which is worth defending rather than glossing. PERM-36 asserts the
other three by attempting them and reading the refusal, and there is no attempt to make for
`truncate`: the client cannot express one, and the catalogue that would answer the question is not in
the exposed schemas, so `information_schema` and `pg_catalog` both answer PGRST205 for the service
role as well as for anon. The alternative to `anon_write_privileges` was a security control with no
test behind it, which is the kind that quietly stops being true. It is the smallest thing that
answers the question: four booleans per relation, no data, `select` granted to `service_role` alone,
and PERM-39 asserts that an anonymous caller cannot read it either.

The second decision is to leave the content security policy alone. The browser suite surfaced that
React cannot use `eval()` in development under it, which costs some dev-mode debugging locally and
nothing in production, because React never uses `eval()` there - the deployed checks report no
refusal at all. Adding `'unsafe-eval'` behind a `NODE_ENV` condition would recover the debugging and
would also mean developing against a policy looser than the one users get, so a violation could pass
locally and only appear once deployed. The policy that ships is the policy to develop against. This
is recorded as a choice rather than left to be read as an oversight by somebody who finds the warning
in a log.


### 2026-08-29 - The sign-up role stays client-chosen, because every fix costs more than the finding

Decided to leave `create_profile_for_new_auth_user` reading the role from `raw_user_meta_data`, which
the client controls, rather than close the finding. Three designs were built and abandoned, and the
decision is really about the third.

Hardcoding `'landlord'` and letting the tenant path set the role afterwards is the obvious answer and
is a privilege escalation of its own. The trigger is the only place `profiles.role` is ever written,
and `prevent_profile_role_change` refuses a later change to every caller including the service role -
measured at `42501`, not assumed. Every tenant created from the lease flow would have become a
landlord, permanently.

Trusting the metadata only when the caller is the service role cannot be implemented, because the
trigger cannot tell who the caller is. GoTrue inserts into `auth.users` on its own pooled connection
as `supabase_auth_admin`, so there is no request context: logged from inside the trigger, both
`admin.createUser` and a public `signUp` show null claims, null `auth.role()`, `current_user`
`postgres`. A check written as "trust the metadata only when the claim is explicitly service_role"
would have been correct and would have forced `'landlord'` for everybody, collapsing into the first
design's bug.

Reading the role from `app_metadata`, which a client cannot set, is the right idea and fails on
timing. GoTrue writes `app_metadata` in a separate transaction after the insert commits, so the
`AFTER INSERT` trigger sees it absent. A `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`,
which fires at the end of the inserting transaction, saw it absent too - which is what proves the
write is a separate transaction rather than a later statement in the same one.

What is left all reacts to that later update, and all of it needs `prevent_profile_role_change`
relaxed so something may set a role after creation. That guarantee holds today against every caller
including the service role, and it is worth more than closing a finding with no impact: a forged
landlord is what `/register` gives anyone, a forged tenant is attached to no tenancy because access
flows from `leases.tenant_profile_id`, and every policy is scoped by ownership as well as role. The
finding stays accepted, with the condition that would change that - any policy granting on role alone
- written beside it.

The general lesson is the one this project keeps paying for and then banking: test the premise before
building on it. Two of the three designs looked correct on paper and were disproved in minutes by
logging what the database actually saw, and the third was disproved by a five-line trigger change.
None of them reached production, and the schema was never touched.


### 2026-08-29 - Changing a password proves the old one, rather than trusting the session

Decided to add a current-password field verified on the server, unconditionally, and to leave
Supabase's own `secure_password_change` switched off. A session used to be the whole requirement:
holding one was enough to set a new password and lock the owner out, demonstrated against an account
whose password was unknown.

The alternative looked cheaper and does not work. `secure_password_change` exempts any session
created in the last 24 hours, which is exactly the window a stolen session is used in, so the
demonstrated takeover would have survived it - and that also means the security review's evidence
never proved the setting was what stood in the way. Where it does apply it calls `reauthenticate()`,
which sends a nonce by email or SMS, and this project has neither channel by design: a landlord
signed in for over a day would have found their password unchangeable. The two are independent, so
enabling both would have made a >24h session need the field and an undeliverable nonce, and fail
whatever the user typed.

Unconditional rather than keyed on `must_change_password`. A tenant replacing a landlord-issued
temporary password proves that temporary password, which they typed to sign in seconds earlier. The
conditional version would have saved them retyping something they were holding, in exchange for a
security-relevant branch that has to stay correct forever, decided from a value the server must
re-derive rather than accept. One path is worth more than the keystroke.

The verification runs on its own client that holds no session and writes no cookie, because signing
in through the server client would rotate the caller's session as a side effect of a read-only check.
It is not signed out afterwards, deliberately: `signOut()` revokes every refresh token the user
holds, which would sign them out of the browser they are standing in.

The part worth remembering is the failure taxonomy. A wrong password and a nonexistent account both
answer `400 invalid_credentials`, which is what keeps the form from being an address oracle; being
throttled answers `429 over_request_rate_limit`. Reporting the third as the first would be worse than
the gap being closed - somebody throttled after a typo would be told their password was wrong and
sent to reset a password that was correct. Both the status and the code are checked, and the codes
were measured rather than assumed.

### 2026-09-01 - A tenancy is offered from a vacant unit, and only from a vacant one

Section 18.1 described a guided first session in three steps and the product only had two: a landlord
who had just added their first unit was looking at a row that said Vacant, offered Add a unit and
Edit, and had to work out unaided that Leases is where a tenancy is recorded. The vacant row now
links to the tenancy form with that unit preselected, through the `unitId` query string the form had
always accepted and nothing was passing.

Offered only when the unit is vacant. The alternative was to offer it on every row and let the
overlap rule refuse the ones that cannot take a tenancy, which would have been less code and one
fewer condition. It was rejected because an action that is going to be refused is worse than no
action: the landlord clicks, fills in a form, and is told no, having learned nothing they could not
have been told by the absence of a link. A reserved unit is excluded for the same reason as an
occupied one - it has an upcoming tenancy, so the dates a new one could take are narrow and the
refusal is the likely outcome.

The cost is that back-to-back tenancies on a reserved unit still start from the Leases page. That is
the rarer case and it keeps the common one honest.

### 2026-09-01 - The logo is placed at four sizes of one size, and the header stays as text

The mark is owned, so no attribution applies and none appears anywhere in the project.

The artwork is a 5000 by 8538 monochrome mark on transparency, in pure black, bleeding to
both side edges with no margin of its own. Rendered and looked at rather than reasoned about, it is
a recognisable building at 48 and 64 pixels tall and an unreadable smudge below roughly 40. That
measured floor decided everything else.

It is therefore not in the header. A header mark would sit at 24 to 32 pixels beside the wordmark,
which is under the floor, and a smudge next to clean type reads as a rendering fault rather than as
a brand - worse than no mark at all. It appears only where there is room to draw it at 48: sign in,
registration, the forced password change, and the head of the rent statement. Those are also the
four screens with no navigation around them, so the mark is doing the job navigation does elsewhere.

It is drawn as a CSS mask over `background-color: var(--foreground)`, not as an image. The artwork is
pure black and nothing else in the product is pure black, so an `<img>`, which paints its own pixels
and lets nothing through, would put the one true black on a page whose text is not. The instruction
was to serve it through `next/image`, and that could not be done as written: a mask `url()` does not
participate in an image element's srcset, so the optimiser never sees it. The reason behind the
instruction was honoured instead - the full-size original decodes to 163 MB of bitmap however small
it is drawn, so the mask loads `logo-mark.png`, a 150 by 256 copy that decodes to 150 KB and stays
sharp past 64 pixels on a four-times display. The original stays in the repository as the source.

Two consequences worth knowing. A CSS mask is blocked over `file://`, so the pages render the mark
blank when opened straight from disk; that is the protocol refusing the mask, not a broken asset.
And a background colour is a background graphic, which browsers drop from print by default, so the
component sets `print-color-adjust: exact` - without it the statement would print a blank gap.

The accessible name is "Rentbook", not "logo". A masked span has no content of its own, so
the name has to be given rather than inferred, and on all four screens the mark stands alone with no
wordmark beside it. Naming it "logo" would tell a screen reader user that a picture exists without
telling them what it says; naming it as the product says the thing the mark is standing in for.

### 2026-09-02 - The headers carry a fragment of the mark, not the mark

Both headers now open with the mark and the words "Rentbook" as one link home. The mark
they draw is not the mark the sign-in, registration, password and statement pages draw. It is the
upper form of it, cropped out and used on its own.

The reason is width, not weight. The whole mark is portrait, 5000 by 8538, so constraining it to a
header's height starves it of width: at 24 pixels tall it is 14 pixels wide, and its busiest
horizontal scanline crosses five strokes inside those 14 pixels. They merge, and what is left is a
smudge that reads as a rendering fault rather than as a logo. The upper form alone is near-square,
so the same 24 pixels of height buy 23 of width for three strokes - roughly 2.7 times the room each.
Rendered at 20, 24 and 32 pixels and looked at rather than reasoned about, it holds at all three.

The alternative was to grow the header until the whole mark fitted. That was measured rather than
guessed. The header is 24 pixels of padding plus its tallest row plus a one pixel border, and the
row is already 28 to 32 pixels tall because of the sign-out button and the navigation pills, so
anything up to 24 pixels costs nothing at all. Above that it starts pushing: the whole mark at its
minimum legible 40 pixels takes the header from 57, 93 and 89 pixels at 1440, 768 and 390 to 65,
105 and 101. Twelve pixels of a phone's header, to get a mark that still reads worse at 40 than the
crop does at 24 - the two were rendered side by side to check. The crop costs nothing, so the header
is unchanged at 57, 93 and 89.

The tenant header gained a wordmark it never had. That is a product change, not a placement: a
tenant on a sub-page had no way back to their own overview except the navigation, which a landlord
has never needed because the wordmark was already there. It points at `/tenant` and never at
`/landlord`.

One link wraps both the mark and the words, so it is one focus stop with one accessible name. The
mark inside is `aria-hidden`: it would otherwise announce a name identical to the text beside it,
and hearing "Rentbook" twice is worse than a picture nobody mentions. This is the opposite
choice from `LogoMark` on the authentication pages, which does carry a name, because there it stands
alone with no words next to it.

### 2026-09-02 - The product is called Rentbook, and the header mark was cut through

Two separate things, recorded together because they landed together.

**The name.** The product is Rentbook. The rename covers every place the words were the product's
name: the wordmark in both headers, the accessible name on the mark, the page title and its template,
the deck's title slide and its per-slide footer, and the headings of README and link.md. Sixteen
occurrences. Eight were left alone, because "rental management" is also the name of the category and
those are descriptions rather than the name - "a rental management app for small landlords" says what
kind of thing this is, and renaming it to "a Rentbook app" would be nonsense. Nothing that is an
identifier moved: not the repository, the Vercel project, the Supabase projects, the package name,
or the deployed hostname. A display name and a slug are different things, and only one of them is
safe to change after deployment.

**The mark.** The header mark had been cropped as a rectangle, (400, 0) to (3900, 3500), chosen by
eye off a coordinate grid. That was wrong, and it showed: the shape read as cut off in the top bar.
The cause was not a container clipping it, not a forced aspect ratio, and not the size. The artwork
is two separate connected shapes - an upper one occupying (943, 0) to (3788, 3341) which touches no
edge of the file, and a lower one which bleeds off the left, right and bottom. The rectangle reached
past the upper shape on two sides and swept in fragments of the lower one, and those fragments had
nowhere to close, so they ran off the edge of the mask.

The fix was to take the shape rather than a rectangle: label the connected components, keep the
upper one, and pad it by four percent so rounding can never shave an edge. Verified by measuring
painted ink along all four edges of the element itself at 1440, 768 and 390 on both headers: zero.
The lesson worth keeping is that cropping artwork by eye off a grid is guessing, and the artwork
could say exactly where its own shapes were the whole time.

**The name under the mark.** The three signed-out pages now show "Rentbook" beneath the mark. It is
set at the size the headers use for the same word, not at the page-title size, so it reads as part of
the lockup rather than as a second heading competing with "Sign in" underneath it. The mark inside
the lockup became decorative when the text arrived, for the same reason it is decorative in the
header: the name is now sitting there in words, and announcing it twice helps nobody.
