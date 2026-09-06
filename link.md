# Submission

Rentbook: a rental system for small landlords, with a tenant portal.

**Submission deadline: 6 September 2026.**

| | |
| --- | --- |
| Live application | https://rental-management-app-wine.vercel.app |
| Repository | https://github.com/lidorStudent/rental-management-app |
| Health check | https://rental-management-app-wine.vercel.app/api/health |

---

## How to review this in ten minutes

Sign in as the landlord `noa.bendavid@example.co.il` (password below). The dashboard opens on what
needs attention rather than on a menu: rent outstanding, problems open, tenancies ending. Follow
**Rent** for every tenancy with what has been charged, received and left over. No status there is
stored. Each is derived from the ledger and today's date, which is why a month moves from part paid
to overdue on its own.

Then break it on purpose. Open **Leases**. The list carries a Term column, so Maya Levi's tenancy
shows the day it ends; that day is the one worth typing, because it still belongs to her. **Record a
tenancy**, choose **Flat 1**, and set the start date to it. Any end date and rent will do.

It is refused, and the refusal explains itself three times over. The banner names the tenancy in the
way by its own dates and gives the first day the unit is free, which is the day after the one you
typed. The start date field says until when the unit is occupied and from when it is free; the end
date field says which tenancy it overlaps. No dates are printed here because the seed places its
tenancies relative to the day it runs, so every one of them moves forward on the first of each month
— read them off the screen.

Nothing is written. That rule is a Postgres exclusion constraint rather than a check in application
code, so two browser tabs cannot race past it.

Sign out and in as `maya.levi@example.co.il`. She sees her own tenancy and nothing else: no landlord
navigation, no way to record a payment, and a landlord address returns her to her own portal. What
matters is where that is enforced. The same request made straight to the database with her
credentials returns zero rows, so a mistake in a page yields nothing rather than somebody else's
data.

If you read three documents, read these sections:

- [Product specification](docs/01-product-specification.md) **section 9** — everything the product
  deliberately does not do, each exclusion with the reason it was a decision.
- [Security](docs/05-security.md) **section 12** — the risks that remain, including a finding where
  three fixes were designed, tested and rejected, with the reasoning kept.
- [Scale](docs/06-scale.md) **section 3** — hundreds of landlords, measured: one landlord's queries
  tripled because of another landlord's rows.

The [architecture explainer](docs/07-architecture-explainer.md) traces five flows from click to
rendered page if you want the code.

Tests sit at three levels. `src/` holds 361 unit and component tests of the rules at their
boundaries. `tests/` holds 146 against a real Postgres as real signed-in users, attacking the
database rather than the interface, which is the only way a policy is proved. `e2e/` holds 28 browser
tests of whole processes. Section 8 of the [test specification](docs/03-test-specification.md)
records five checks a machine cannot judge, with dated results.

---

## Demo accounts

**Demo data.** Every account below is created by `supabase/seed.ts`, and the portfolio behind them is
invented: no real person, address or tenancy appears anywhere in it. That is why these credentials
can be written down here.

Password for all of them: `Demo-Rental-2026!`

| Role | Email | What it shows |
| --- | --- | --- |
| Landlord | `noa.bendavid@example.co.il` | Two buildings, five units, tenancies that are active, ended and upcoming, a ledger holding settled months, a part payment and months in arrears, and repairs in every status |
| Landlord | `eitan.shapira@example.co.il` | A different building and tenant, and no sight of anything of Noa's. Sign in as both to see the isolation the policies enforce |
| Tenant | `maya.levi@example.co.il` | An active tenancy of Noa's, in arrears: her ledger stops at the seventh month, so every month charged since reads Overdue. How many that is depends on the day you sign in |
| Tenant | `yonatan.azoulay@example.co.il` | An active tenancy of Noa's with a part payment against the current month. The month reads **Part paid** while its due day is still ahead and **Overdue** once it has passed, because past due outranks part paid. Sign in as Noa as well: the landlord's schedule row shows the remainder against that month straight away, while the tenant's Outstanding figure counts only what has been charged so far, and the current month is not charged until its due day. The two disagree before that day and agree after it |
| Tenant | `shira.mizrahi@example.co.il` | A tenancy that has ended, with its history still readable |
| Tenant | `dana.peretz@example.co.il` | An active tenancy of Eitan's, with the current month unpaid |

---

## The ten deliverables

| # | Deliverable | Where it is |
| --- | --- | --- |
| 1 | Live Vercel URL, publicly reachable | https://rental-management-app-wine.vercel.app |
| 2 | GitHub repository | https://github.com/lidorStudent/rental-management-app |
| 3 | Product specification | [docs/01-product-specification.md](docs/01-product-specification.md) |
| 4 | Technical planning document | [docs/02-technical-plan.md](docs/02-technical-plan.md) |
| 5 | Test specification | [docs/03-test-specification.md](docs/03-test-specification.md) |
| 6 | Test code | [src/](src/) 361 unit and component tests in 34 files, beside the code they test; [tests/](tests/) 146 database and permission tests in 9 files; [e2e/](e2e/) 28 browser tests, plus 7 read-only checks against the deployed address |
| 7 | Scale document | [docs/06-scale.md](docs/06-scale.md) |
| 8 | Security document | [docs/05-security.md](docs/05-security.md) |
| 9 | Local run instructions, with every environment variable explained | [README.md](README.md), sections "Local setup, from a clean clone" and "Environment variables" |
| 10 | Presentation deck for 10 to 15 minutes | [docs/presentation.pdf](docs/presentation.pdf), 15 slides, with the slide-by-slide script in [docs/09-presentation-script.md](docs/09-presentation-script.md) |

---

## Every document

| Document | What it is |
| --- | --- |
| [README.md](README.md) | What the product is, the stack with a reason for each choice, prerequisites, setup from a clean clone, every environment variable, how to run each test suite, the demo accounts, and the project structure |
| [docs/00-course-requirements.md](docs/00-course-requirements.md) | The checklist every phase of the project was audited against |
| [docs/01-product-specification.md](docs/01-product-specification.md) | The problem, the users, the customer, the business goals, the capabilities, and the central processes end to end |
| [docs/02-technical-plan.md](docs/02-technical-plan.md) | The architecture decided before any code: components, entities, every page, actions, data flow, permissions, libraries, folder and component structure, schema, CRUD, API, business logic, state, errors, validation |
| [docs/03-test-specification.md](docs/03-test-specification.md) | Every test case with why it matters, and the five documented manual tests with their recorded results |
| [docs/04-deployment.md](docs/04-deployment.md) | How the deployment is configured, and what to look at when the deployed copy misbehaves |
| [docs/05-security.md](docs/05-security.md) | Authentication, authorisation, which actions need a session, how users are kept apart, validation, how actions and the one route handler are protected, where the secrets are, and the risks that remain |
| [docs/06-scale.md](docs/06-scale.md) | Behaviour at tens and hundreds of users, measured against synthetic portfolios and confirmed with query plans: the heavy queries, every index, what is not loaded, pagination, the client and server split, the limits, and what to change first |
| [docs/07-architecture-explainer.md](docs/07-architecture-explainer.md) | The internal explainer: the architecture with a diagram, the key files, five flows traced from click to revalidated page, the schema and why it is shaped this way, the tests, and the decisions |
| [docs/08-study-guide.md](docs/08-study-guide.md) | One progressive guide to the whole system: the five concepts to know cold, the ten files that matter most, and twenty examiner questions with answers |
| [docs/09-presentation-script.md](docs/09-presentation-script.md) | The slide-by-slide script with timings, and the demo click by click, including the two deliberate failures |
| [docs/presentation.pdf](docs/presentation.pdf) | The deck itself, 15 slides |
| [docs/decisions.md](docs/decisions.md) | Every decision worth defending, with its alternatives and its reasoning |
| [docs/learning/01-auth-and-database.md](docs/learning/01-auth-and-database.md) | How a request proves who it is |
| [docs/learning/02-business-rules.md](docs/learning/02-business-rules.md) | The rules, and why they are pure functions |
| [docs/learning/03-data-flow.md](docs/learning/03-data-flow.md) | Two journeys through the system, a write and a read |
| [docs/learning/04-security-model.md](docs/learning/04-security-model.md) | What the permission tests prove |
| [docs/diagrams/architecture.svg](docs/diagrams/architecture.svg) | The architecture diagram used in the deck |
| [docs/diagrams/entity-relationship.svg](docs/diagrams/entity-relationship.svg) | The entity relationship diagram used in the deck |
| [supabase/README.md](supabase/README.md) | The database: the two projects, how a migration reaches each, and what each migration contains |

---

## Running it yourself

[README.md](README.md) has the full path from a clean clone. In short: `npm install`, two Supabase
projects with the migrations applied by `supabase db push`, `.env.local` and `.env.test` filled in
from `.env.example`, `npm run db:seed`, then `npm run dev`.

No secret value appears in this repository or in its history. `.env.example` lists every variable by
name with no values, and the real files are ignored by git.
