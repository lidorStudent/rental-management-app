# Rental Management

A rental management application for small landlords, with a portal for their tenants. A landlord
records their buildings, the units inside them and who rents which unit for how long, writes down
rent as it arrives, and follows repairs from the moment a tenant reports one until the tenant
confirms it is fixed. Rent status is never typed in: the system derives it from the ledger and
today's date. A tenant signs in to see their own tenancy, what they have paid, what is outstanding,
and the problems they have reported. It is a record of money received, not a payment processor.

| | |
| --- | --- |
| Live application | https://rental-management-app-wine.vercel.app |
| Repository | https://github.com/lidorStudent/rental-management-app |
| Health check | https://rental-management-app-wine.vercel.app/api/health |

---

## The stack, and why each piece is here

| Choice | Why this one |
| --- | --- |
| Next.js 16, App Router | Server components fetch data on the server and send HTML, so what a page may read is decided where the session is, never in the browser |
| React 19 | What Next.js runs. Used for interaction only: forms, filters, confirmations |
| TypeScript, strict | The database's shape is generated into `src/types/database.ts`, so a wrong column name fails the build instead of returning undefined at runtime |
| Supabase Postgres | A real relational database with real constraints. The rule that a unit cannot have two overlapping tenancies is an exclusion constraint, which application code cannot enforce under concurrency |
| Supabase Auth | Password accounts, sessions and token refresh without writing password hashing, which is the wrong thing to hand-roll in a graded project or anywhere else |
| Row Level Security | Authorisation lives in the database, so a mistake in a page returns no rows rather than somebody else's rows |
| `@supabase/ssr` | Keeps the session in a cookie the server reads. This project hardens that cookie; see [docs/05-security.md](docs/05-security.md) |
| Tailwind CSS 4 | Styling next to the markup for anything local to a component. What must be identical everywhere - the palette, the five status meanings, the type scale - is a token in `src/app/globals.css` instead, because a value repeated in thirty files drifts |
| shadcn/ui on Radix | Accessible primitives copied into `src/components/ui` rather than a dependency that owns the look and has to be fought |
| Zod | One schema per input, imported by both the form and the server action, so client and server validation cannot drift apart |
| react-hook-form | Field-level feedback as somebody types, without re-rendering the page on every keystroke |
| Vitest, React Testing Library | The rules and the form components tested offline in seconds, so the fast suite stays fast |
| Playwright | The flows tested in a real browser, by accessible role and label, which is also how the interface is checked for a keyboard and a screen reader |
| Vercel | The deployment target Next.js is built for. A push to `main` is a deployment |
| GitHub Actions | One scheduled job calling `/api/health` daily, because a free Supabase project is paused after a week of silence |

Deliberately absent: no state management library, no data fetching library, no PDF library, no email
service, no ORM. Each of those is a dependency this project would have to justify, and each has a
plainer answer here: server components, server actions, the browser's own print, a temporary
password handed over by the landlord, and SQL.

---

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| macOS | any current version | Built and verified on macOS 15. Nothing here is macOS-only, but the commands below are written for zsh |
| Node.js | 22.6 or newer | Verified on 26.7.0. The floor is 22.6 because the seed script runs TypeScript directly with `--experimental-strip-types` |
| npm | 10 or newer | Verified on 11.19.0. Comes with Node.js |
| git | any current version | |
| Supabase CLI | 2.x | Verified on 2.115.0. Needed only to apply migrations: `brew install supabase/tap/supabase` |
| A Supabase account | free plan is enough | Two projects, for the reason in the next section |
| Playwright browsers | installed once per machine | `npx playwright install chromium`, step 7 below |

---

## Local setup, from a clean clone

### 1. Clone and install

```sh
git clone https://github.com/lidorStudent/rental-management-app.git
cd rental-management-app
npm install
```

npm 11 ends the install with a warning that it did not run the install scripts of `fsevents` and
`unrs-resolver`. Nothing in this project needs them: every suite, the linter and the production
build were run from a clean clone in exactly this state.

### 2. Create two Supabase projects

In the Supabase dashboard, create two projects in the same region:

- one for running the application, called something like `rental-management-app`
- one for the tests, called something like `rental-management-app-test`

They are separate because the permission tests and the browser tests sign real users in and write
real rows. Pointed at the application's project they would put test tenancies into the portfolio you
are looking at. One project also works if all you want is to click around, at the cost that running
the test suites will write into the data you are looking at.

### 3. Apply the schema to both projects

The CLI applies migrations to whichever project is linked, so link and push once per project. Each
`link` asks for that project's database password, which you set when you created it.

```sh
supabase link --project-ref <application project reference>
supabase db push --linked

supabase link --project-ref <test project reference>
supabase db push --linked
```

The project reference is the subdomain of the project URL: `https://<reference>.supabase.co`. What
each migration contains is described in [supabase/README.md](supabase/README.md).

### 4. Write the two environment files

```sh
cp .env.example .env.local
cp .env.example .env.test
```

Fill `.env.local` with the **application** project's values and `.env.test` with the **test**
project's values. Every variable is in the table below. Both files are ignored by git and must stay
that way.

### 5. Seed the demo data

```sh
npm run db:seed              # seeds the project named in .env.test
npm run db:seed:production   # seeds the project named in .env.local
```

Run both: the first gives the test suites the portfolio they expect, the second gives you something
to look at. The script is idempotent, so running it again updates the same rows rather than creating
a second portfolio. It refuses to touch the author's deployed project unless `--confirm-production`
is passed, which `db:seed:production` does; against your own project the guard does not apply.

### 6. Run the application

```sh
npm run dev
```

Open http://localhost:3000. You will be sent to `/login`, because every route except `/login` and
`/register` requires a session. Sign in with one of the demo accounts below, or register a new
landlord account and start from an empty portfolio.

### 7. Install the browser for the end-to-end tests

```sh
npx playwright install chromium
```

One download per machine. Only needed for `npm run test:e2e`.

---

## Environment variables

| Name | Purpose | Where to get it | Public or secret | Required |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Which Supabase project to talk to | Dashboard, Project Settings, Data API, Project URL | Public. `NEXT_PUBLIC_` means Next.js inlines it into the browser bundle | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The key the browser and the server use for ordinary, signed-in-user queries | Dashboard, Project Settings, API Keys, `anon public` | Public by design. It grants nothing on its own, because every table is behind Row Level Security and every query runs as the signed-in user. `tests/anonymousAccess.test.ts` is the proof | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses Row Level Security. Used by exactly one server action, to create a tenant's account through the Auth admin API, and by the seed and the test suites | Dashboard, Project Settings, API Keys, `service_role secret` | **Secret.** No `NEXT_PUBLIC_` prefix, so it is never sent to a browser, and `src/lib/supabase/adminClient.ts` imports `server-only` so it cannot be pulled into client code | Yes |
| `SEED_USER_PASSWORD` | Overrides the password the seed gives every demo account | You choose it | Secret in spirit; it is a demo password | No. Defaults to `Demo-Rental-2026!` |
| `PLAYWRIGHT_BASE_URL` | Points the browser tests at a deployed address instead of the local dev server | The deployed URL | Public | No. Defaults to `http://localhost:3000` |

`CI` and `NODE_ENV` are also read, by the Playwright config and the cookie settings respectively.
Both are set by the tooling; neither belongs in an environment file.

### Why there are two environment files

| File | Read by | Points at |
| --- | --- | --- |
| `.env.local` | `next dev`, `next build`, `npm run db:seed:production` | The project the application serves |
| `.env.test` | `npm run test:db`, `npm run test:e2e` (through `playwright.config.ts`), `npm run db:seed` | The project the tests are allowed to write to |

The separation is enforced, not merely documented. `tests/support/testDatabase.ts` and
`playwright.config.ts` both compare the project reference in `.env.test` against the deployed
project's and refuse to start if they match, before a single test runs. Playwright also hands
`.env.test` to the dev server it starts, and Next.js does not override variables that are already
set, so the browser tests run against the test project even though `.env.local` exists.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | The development server on http://localhost:3000 |
| `npm run build` | The production build. Type checks the whole project, so a type error fails it |
| `npm start` | Serves the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint over the repository |
| `npm run format` | Prettier over everything except the documents |
| `npm run db:seed` | Seeds the project in `.env.test` |
| `npm run db:seed:production` | Seeds the project in `.env.local` |

---

## The test suites

Four suites, run separately on purpose: the fast one stays offline and finishes in seconds, and the
ones that need a database or a browser are asked for by name.

**One caution before you run them back to back.** Supabase throttles authentication: thirty sign-in
or sign-up requests per five minutes per IP address, set in `supabase/config.toml`. The database
suite signs in twelve times and the browser suite twenty-three, so running both inside five minutes
can exceed it and produce timeouts that look like product failures and are not. Leave a few minutes
between them, or run them one at a time.

### `npm test` - unit and component tests

343 tests in 31 files, no network, about three seconds. Vitest, with React Testing Library for the
components. They live beside what they test, as `<name>.test.ts` next to `<name>.ts`.

Covers the derived rules, which is where the product's thinking lives: the rent schedule and the
status derived from it, lease overlap and lifecycle, money parsed from what somebody typed, date
arithmetic, pagination arithmetic, and the Zod schemas. Then the form components: that a field
error is announced to a screen reader, that a server-side error lands next to the right field, that
a submit button disables itself while a submission is in flight.

### `npm run test:db` - permission and database tests

129 tests in 6 files, about 34 seconds, against the **test** Supabase project with real credentials
and real policies. Refuses to run if `.env.test` points at the deployed project.

| File | Covers |
| --- | --- |
| `tests/landlordIsolation.test.ts` | One landlord can read, change and delete none of another's properties, units, leases, payments, requests or aggregate views, and can do all of it to their own |
| `tests/tenantIsolation.test.ts` | A tenant reads only their own tenancy and ledger, and cannot write to leases or payments by any route |
| `tests/anonymousAccess.test.ts` | The anonymous key, which is in the browser bundle, reads and writes nothing anywhere |
| `tests/serverActions.test.ts` | Actions refuse the wrong role, answer another landlord's identifier exactly as they answer one that does not exist, and take ownership from the session rather than from the payload |
| `tests/domainInvariants.test.ts` | The five domain invariants at the database level, including the exclusion constraint that refuses overlapping tenancies |
| `tests/schemaGuarantees.test.ts` | What the schema refuses on its own: the check constraints, the per-building uniqueness of a flat label, every cascade and restrict, and the two triggers |

### `npm run test:e2e` - browser tests

22 tests in a real Chromium against the test project, about three minutes. Playwright starts the dev
server itself. Each test builds its own landlord, building and tenant through the admin API and
removes them afterwards, so the suite can be run twice in a row in any order.

| File | Covers |
| --- | --- |
| `e2e/landlordGoldenPath.spec.ts` | Register, add a building and a unit, record a tenancy, create the tenant's account, record rent, watch the status change |
| `e2e/tenantGoldenPath.spec.ts` | Arrive with a temporary password, be forced to change it, find the tenancy and the ledger, report a problem, confirm the repair |
| `e2e/negativePaths.spec.ts` | Overlapping tenancies, invalid forms, a tenant reaching for a landlord route, one tenant naming another's record, every protected route while signed out |
| `e2e/sessionCookie.spec.ts` | The session cookie is HTTP-only and unreadable by page JavaScript, sign-out ends it, and an expired access token is refreshed rather than signing the user out |
| `e2e/interfaceStates.spec.ts` | The current link is marked, a delete states its consequence before acting, and a tenancy that has ended or has not started explains itself |
| `e2e/deploymentSmoke.spec.ts` | Skipped unless `PLAYWRIGHT_BASE_URL` is set. Read-only checks against a deployed address, including the cookie's `secure` flag, which only turns on in a production build, and the response headers, which only the platform can be asked for |

Against a deployed address:

```sh
PLAYWRIGHT_BASE_URL=https://rental-management-app-wine.vercel.app npx playwright test e2e/deploymentSmoke.spec.ts
```

### Documented manual tests

Five checks a script cannot honestly make - the print stylesheet, layout at different window sizes,
the first sign-in experience, a keyboard and screen reader pass, and the deployment smoke test - are
written up with their steps and their recorded results in
[docs/03-test-specification.md](docs/03-test-specification.md).

---

## Demo accounts

**Demo data.** Every account below is created by `supabase/seed.ts` with the same well-known
password, and the portfolio behind them is invented. Nothing here is a real person, a real address
or a real tenancy, and these credentials are safe to publish precisely because the data is fictional.

Password for all of them: `Demo-Rental-2026!` (or whatever `SEED_USER_PASSWORD` was set to).

| Role | Email | What they see |
| --- | --- | --- |
| Landlord | `noa.bendavid@example.co.il` | Two buildings, five units, tenancies that are active, ended and upcoming, a ledger with a paid, a partial and an overdue month, and repairs in every status |
| Landlord | `eitan.shapira@example.co.il` | A different building with its own tenant, and no sight of anything of Noa's. Sign in as both to see the isolation the policies enforce |
| Tenant | `maya.levi@example.co.il` | An active tenancy of Noa's, in arrears: her ledger stops two months short, so the portal shows overdue months and an outstanding balance. Checked on the deployed site: ₪6,500.00 due this month, ₪13,000.00 outstanding, two months past their due date |
| Tenant | `yonatan.azoulay@example.co.il` | An active tenancy of Noa's, part paid: a cash payment covers some of the current month, which is what a partial rent status looks like |
| Tenant | `shira.mizrahi@example.co.il` | A tenancy that has ended |
| Tenant | `dana.peretz@example.co.il` | An active tenancy of Eitan's, with the current month unpaid. Sign in as Eitan to see the same tenancy from the landlord's side |

---

## Project structure

```text
rental-management-app/
├── CLAUDE.md                          the standing rules this project was built under
├── README.md
├── docs/                              every document, listed below
├── supabase/
│   ├── README.md                      how a migration reaches each project
│   ├── config.toml                    auth settings, pushed with supabase config push
│   ├── migrations/                    the only definition of the schema, applied in filename order
│   └── seed.ts                        the demo portfolio, through the Auth admin API
├── src/
│   ├── proxy.ts                       runs before every request: refreshes the session, routes by role
│   ├── app/                           routes. Server components read, pages render
│   │   ├── login, register, change-password
│   │   ├── landlord/                  dashboard, properties, units, leases, rent, maintenance, statements
│   │   ├── tenant/                    the portal: tenancy, payments, maintenance, statement
│   │   └── api/health/route.ts        the one route handler
│   ├── actions/                       the twenty server actions. Every write goes through one
│   ├── components/                    interface, grouped by subject. ui/ is shadcn's primitives
│   ├── lib/
│   │   ├── supabase/                  the three clients, and the session cookie's flags
│   │   ├── authentication/            who is signed in, and the role guards
│   │   ├── rent/, leases/, money/, dates/, pagination/   the derived rules, as pure functions
│   │   └── validation/                one Zod schema per input, shared by form and action
│   └── types/database.ts              generated from the schema
├── tests/                             permission and database tests (npm run test:db)
├── e2e/                               browser tests (npm run test:e2e)
└── .github/workflows/health-check.yml daily call to /api/health
```

Two shapes are worth knowing before reading the code. Every server action follows the same seven
steps in the same order, so learning one teaches all twenty; the file
[src/actions/propertyActions.ts](src/actions/propertyActions.ts) documents them at the top. Every
list page follows the same shape too: parse the page number, query with a range and an exact count,
redirect if the page is past the end, render with `PaginatedTable`.

---

## The documents

| Document | What it is |
| --- | --- |
| [docs/00-course-requirements.md](docs/00-course-requirements.md) | The checklist every phase of this project was audited against |
| [docs/01-product-specification.md](docs/01-product-specification.md) | The problem, the users, the features, the invariants |
| [docs/02-technical-plan.md](docs/02-technical-plan.md) | The architecture, the schema, the routes, the decisions taken before any code |
| [docs/03-test-specification.md](docs/03-test-specification.md) | Every test case, why it matters, and the manual tests with their recorded results |
| [docs/04-deployment.md](docs/04-deployment.md) | How the deployment is configured and what to look at when it misbehaves |
| [docs/05-security.md](docs/05-security.md) | What is actually done about authentication, authorisation, validation and secrets, and which risks remain |
| [docs/06-scale.md](docs/06-scale.md) | How the system behaves at size, measured rather than assumed, and what to change first |
| [docs/decisions.md](docs/decisions.md) | Every decision worth defending, with its alternatives and its reasoning |
| [docs/07-architecture-explainer.md](docs/07-architecture-explainer.md) | The internal explainer: the architecture, the key files, every flow traced, the schema, the tests, the decisions |
| [docs/08-study-guide.md](docs/08-study-guide.md) | One progressive guide to the whole system, with the five concepts and twenty questions with answers |
| [docs/09-presentation-script.md](docs/09-presentation-script.md) | The slide-by-slide script with timings, and the demo click by click |
| [docs/presentation.pdf](docs/presentation.pdf) | The deck itself, fifteen slides, built from that script |
| [docs/learning/01-auth-and-database.md](docs/learning/01-auth-and-database.md) | How the session and the database fit together |
| [docs/learning/02-business-rules.md](docs/learning/02-business-rules.md) | The derived rules, and why none of them is stored |
| [docs/learning/03-data-flow.md](docs/learning/03-data-flow.md) | What happens between a click and a row |
| [docs/learning/04-security-model.md](docs/learning/04-security-model.md) | The authorisation model, layer by layer |
| [supabase/README.md](supabase/README.md) | The database: the two projects, the migrations, what each one contains |
