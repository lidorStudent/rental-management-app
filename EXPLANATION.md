# What I built, and how to use it

Rentbook is a rental management application for a landlord with a handful of flats, and a portal for
their tenants. The landlord records their buildings, who rents which unit on what terms, rent as it
arrives, and repairs from the moment a tenant reports one until the tenant confirms it is fixed;
tenants see their own tenancy and nothing else. It records money that has already arrived, and is
not a payment processor.

## Where it is

- Live: https://rental-management-app-wine.vercel.app
- Repository: https://github.com/lidorStudent/rental-management-app

## Signing in

Every account uses the password `Demo-Rental-2026!`. The data is invented: no real person or tenancy
appears in it. The streets are real, the buildings on them are not.

| Account | What it shows |
| --- | --- |
| `noa.bendavid@example.co.il` | Landlord. Two buildings, five units, four tenancies: active, ended, upcoming |
| `eitan.shapira@example.co.il` | Landlord. One building, one tenant, no sight of anything of Noa's |
| `maya.levi@example.co.il` | Tenant of Noa's, in arrears — her ledger stops short of the present |
| `yonatan.azoulay@example.co.il` | Tenant of Noa's with a part payment against the current month |
| `shira.mizrahi@example.co.il` | Tenant whose tenancy has ended, history still readable |
| `dana.peretz@example.co.il` | Tenant of Eitan's, with the current month not yet paid |

## A route through it, about five minutes

1. **Sign in as Noa.** The dashboard opens on what needs attention rather than on a menu: rent
   outstanding, open problems, occupancy, rent collected this month.
2. **Follow Rent.** Every tenancy with what it was charged, what arrived, and what is left over. No
   status there is stored; each is worked out from the ledger and today's date, which is why a month
   turns overdue on its own.
3. **Try to create an overlapping tenancy.** Open **Leases**. The Term column shows the day Maya
   Levi's tenancy ends, and that day still belongs to her. Choose **Record a tenancy**, pick **Flat
   1**, set the start date to it. The application check refuses it before anything is written, three
   times over: a banner naming the tenancy in the way and the first free day, plus a message against
   each date field. Underneath, a Postgres exclusion constraint is what holds when two tabs race:
   both requests can read "no conflict" before either writes, which an application check cannot
   prevent and a constraint can.
4. **Sign out and in as Maya.** Her own tenancy, ledger and problems, and nothing else. No landlord
   navigation, no way to record a payment; a landlord address returns her to her portal, and another
   tenant's record gives the same "not found" as one that never existed — enforced by the database
   rather than by the page.

## What it does

- **Properties and units.** Buildings and the flats inside them. A house is a property with one unit.
- **Tenancies.** Who rents which unit, for how long, at what rent, due on which day. A unit can never
  hold two overlapping tenancies.
- **The rent ledger.** The landlord records payments as they arrive. The months and their statuses —
  due, part paid, paid, overdue — are derived from that ledger and today's date, never typed in.
- **Maintenance.** A tenant reports a problem; the landlord moves it through submitted, acknowledged,
  in progress and resolved; the tenant confirms the repair.
- **Statements.** Either side can produce a rent statement for a date range and print it. The
  stylesheet drops the navigation and buttons, so what prints is the document.

## How it is built

Next.js 16 with the App Router, TypeScript in strict mode, Supabase for Postgres and authentication,
deployed on Vercel. Reads happen in server components and writes in server actions, so no Supabase
client runs in the browser and the session never leaves the server. Authorisation is not the
interface's job: 29 Row Level Security policies on six tables decide which rows exist for the
signed-in user, so a page that forgot its filter returns nothing rather than somebody else's data.

## The documents

| Where | What it answers |
| --- | --- |
| [link.md](link.md) | The submission index: every deliverable and where it is |
| [README.md](README.md) | Running it locally, the environment variables, and the test suites |
| [docs/01-product-specification.md](docs/01-product-specification.md) | The problem, users, customer, goals, and each process end to end |
| [docs/02-technical-plan.md](docs/02-technical-plan.md) | The architecture decided before any code: pages, actions, schema, validation |
| [docs/03-test-specification.md](docs/03-test-specification.md) | Every test case with why it matters, and five manual tests with dated results |
| [docs/05-security.md](docs/05-security.md) | Authentication, authorisation, isolation, secrets, and remaining risks |
| [docs/06-scale.md](docs/06-scale.md) | Measured behaviour at tens and hundreds of users, and what to change |
| [docs/presentation.pdf](docs/presentation.pdf) | The deck, 15 slides |

`docs/` also holds a deployment note, an explainer, a study guide and a decisions log.

# What was easy and what was hard

**Easier than I expected.** Deriving rent status rather than storing it. I expected it to be the
fiddly part, and writing the rules as plain functions made it stop being one. Plain means each rule
takes its inputs and returns an answer, reaching for nothing else: no database call, no reading of
the clock. Today's date arrives as an argument, which is what makes them testable at their
boundaries — to ask what happens on the day rent falls due, you pass in that day. What I did not
expect was how much it saved elsewhere: no status column, nothing to go stale, no two screens
disagreeing. Row Level Security was the same: slow work, but the isolation held. The one policy that
was wrong was wrong about width rather than about ownership — `profiles_update_own` let an account
clear its own `must_change_password`, which made a forced password change a suggestion.

**The lease boundary.** Does a tenancy ending on the 31st conflict with one starting then? A lease
until 31 May means the tenant has the flat that day, so the next starts 1 June. The application
check and the database constraint had to give the same answer, because a rule split across two
places will eventually disagree with itself, and the failure has a shape: the form accepts a tenancy
that Postgres then refuses. I had written "exclusive end boundary" without considering it properly.
What bothered me was that the instruction I had written disagreed with the constraint already in the
database, and I had not seen it.

**The region.** A performance pass put every query at 84 to 102 ms against a network floor of about
85, so the database did almost no work: the cost was the round trip, not the query. I was not
looking for it. I could not believe it was one line in `vercel.json`. Three pairs of queries I
batched to save round trips saved nothing: fixing the latency first decided whether the other was
worth anything.

**The role trigger.** Three fixes, each failing for a different reason, each needing a probe to
disprove, not an argument. Hardcoding the role would have made every tenant a landlord permanently,
because the immutability trigger refuses a correction even from the service role, the key that
bypasses every policy: a fix meant to remove an escalation would have created one. What stopped me:
someone calling the Auth API directly can ask for the landlord role, but what they get is what
`/register` hands anyone, an account owning nothing. The finding has no impact, and every route left
to close it meant relaxing a rule that holds against every caller, service role included.

**Checks that passed and should not have.** The security document said the session cookie was
HTTP-only, and it was not: the library leaves it readable for a browser client I never used. It was
the first time I realised a document could be confidently wrong about the thing it was most sure of.
The tests had their own version of this: a test meant to prove the anonymous role cannot write
called `update({})` with an empty payload, which never reaches the permission check, so it passed
with the grant still in place. Nothing about it looked wrong: a test that passes for the wrong
reason looks like a test that works. The logo check was green three times against a mark that read
as half a shape, measuring whether the artwork was clipped, not whether it was one. The screen
reader was the same: what was missing was the message's association with the input, which no DOM
assertion can fail on. Each check was correct, and answering a question next to the one that
mattered — is it clipped, not is it a shape; is the message present, not is it announced. I had
treated manual checks as not worth automating. They are the things a machine cannot see.

**Working this way.** Judging it meant knowing the system well enough to tell when it was wrong. I
could not have overruled the lease boundary without knowing what a lease term means, nor accepted
the password gate was no defect without following how Next dispatches a server action — to the route
that owns it, not to the URL the browser is on. Once it told me a security hole I had asked it to
close was not one, and it was right. Twenty times something written down did not match the code, and
nothing caught it. Checking claims against reality one at a time took longer than the building.
