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
