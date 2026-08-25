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

