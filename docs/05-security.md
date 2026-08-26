# Security

What this application actually does to keep one person's data away from another, written after
reading the code rather than from the plan. Every claim below names the file it can be checked in.
Where something is not done, it is in section 9 rather than described as though it were.

Two sentences that hold everywhere and are worth reading first. The signed-in user is decided in one
place, `src/lib/authentication/getSignedInProfile.ts`, from the session cookie and never from
anything the browser sent in a form. The boundary that actually stops a request is Row Level
Security in Postgres, `supabase/migrations/20260825122721_row_level_security.sql`, so a mistake in a
page or an action produces an empty result rather than somebody else's rows.

---

## 1. Authentication, sessions and cookies

**Accounts.** Supabase Auth holds the credentials. This application never sees a password hash and
never writes one. Two ways in exist and no more: a landlord registers themselves at `/register`,
which calls `registerLandlordAccount` in `src/actions/authenticationActions.ts`, and a tenant is
given an account by their landlord (section 8). The role is written into the account's metadata at
creation, and the database trigger `create_profile_on_auth_user_insert`
(`supabase/migrations/20260825122011_core_schema.sql:83`) turns it into the profile row that the
rest of the system treats as the truth about who somebody is. `registerLandlordAccount` sends
`role: "landlord"` and nothing else can be requested through it, so the self-service route cannot
mint a tenant of somebody else's building.

**Password rules.** Ten characters with an upper case letter, a lower case letter and a digit. The
rule is set on the Supabase projects themselves in `supabase/config.toml` (`minimum_password_length
= 10`, `password_requirements = "lower_upper_letters_digits"`) and mirrored in
`src/lib/validation/authenticationSchemas.ts`, so the form can refuse a weak password with a useful
message and the Auth service refuses it again if the form is bypassed.

**Signing in.** `signIn` validates the input, calls `signInWithPassword`, and on any failure returns
one message: "That email address and password do not match an account." A wrong password and an
address with no account are answered identically, so the form cannot be used to discover who has an
account here. Registration does the same with `SIGN_UP_REFUSED_MESSAGE`.

**The session.** Supabase issues an access token, a signed JWT valid for one hour (`jwt_expiry =
3600` in `supabase/config.toml`), and a refresh token with rotation enabled. `@supabase/ssr` keeps
both in one cookie. The application never decodes that cookie to decide who is asking: every check
goes through `supabase.auth.getUser()`, which verifies the token with the Auth service, rather than
`getSession()`, which would only report what the cookie claims. The role is then read from the
`profiles` table and never from the token, because a signed-in user can edit their own token
metadata through the Auth API and cannot edit their profile row: the trigger
`profiles_role_is_immutable` refuses a role change outright.

**The cookie's flags.** `src/lib/supabase/sessionCookieOptions.ts` sets `httpOnly`, `sameSite=lax`,
and `secure` whenever `NODE_ENV` is `production`. Both places that write the cookie use it:
`src/lib/supabase/serverClient.ts` when somebody signs in, and
`src/lib/supabase/middlewareClient.ts` when the proxy rotates a token.

This is a deliberate departure from the library's default. `@supabase/ssr` leaves the cookie
readable by page JavaScript so that its browser client can hydrate a session from `document.cookie`.
This project has no browser client — `createSupabaseBrowserClient` was deleted, because a client
that cannot read the session is worse than no client at all — and reads the session only on the
server, so the default was paying an XSS cost for a feature never used. The cookie carries the
refresh token as well as the access token, which is the part that matters: a script that could read
it could keep the session alive long after the tab was closed. `docs/decisions.md` records the
trade-off, which is that nothing in the browser can ever be session-aware on its own; anything that
needs to know is handed what it needs as a prop by a server component.

The flags are asserted rather than assumed. `e2e/sessionCookie.spec.ts` signs in as a landlord and
as a tenant, checks `httpOnly`, `sameSite` and `secure`, and reads `document.cookie` in the page to
confirm no token appears in it. Because `secure` only turns on in a production build,
`e2e/deploymentSmoke.spec.ts` repeats the check against the deployed address, where it is true.

**Refreshing.** `src/proxy.ts` runs before every page render and every server action. It calls
`getUser()`, which exchanges an expired access token for a fresh one, and the rotated cookie is
written onto the response. `redirectTo` in the same file copies those cookies onto a redirect
response, because building a fresh redirect without them would throw the rotated token away and sign
the user out on their next click. `e2e/sessionCookie.spec.ts` proves this end to end by planting a
session whose access token has expired and loading a protected page: it renders signed in, and the
cookie has been replaced.

**Signing out.** `signOut` calls `supabase.auth.signOut()`, which revokes the session at the Auth
service and clears the cookie, then redirects to `/login`. The end-to-end tests confirm the cookie
is gone afterwards and that the protected page redirects.

---

## 2. The layers, and which one is the boundary

| Layer | Where | What it does | What it does not do |
| --- | --- | --- | --- |
| Routing | `src/proxy.ts` with `src/lib/authentication/redirectDestination.ts` | Sends an unauthenticated request to `/login`, a tenant out of `/landlord`, a landlord out of `/tenant`, and anybody who must change their password to `/change-password` | It is convenience, not protection. A request that slipped past it still meets everything below |
| Role guard | `requireLandlordProfile.ts`, `requireTenantProfile.ts`, both built on `getSignedInProfile.ts` | Refuses an action asked for by the wrong role, by throwing rather than returning null so a caller cannot forget the empty case | It does not know which rows are whose |
| Derived ownership | Every action in `src/actions/` | Stamps writes with the acting user's id and looks rows up without trusting any identifier of ownership from the client | It is application code, so it can contain a mistake |
| Row Level Security | `supabase/migrations/20260825122721_row_level_security.sql` and two later migrations, 29 policies over 6 tables | Decides, inside Postgres, which rows exist for the connection asking | Nothing. This is the boundary |
| Column rules | `profiles_role_is_immutable`, `maintenance_requests_tenant_confirms_only` | A policy chooses rows, never columns, so these triggers keep a permitted update from touching a column it should not | — |
| Constraints | `supabase/migrations/20260825122011_core_schema.sql` | Overlapping tenancies, negative rent, future receipts and the rest are refused by the schema | They are about correctness rather than permission |

The three aggregate views (`lease_rent_summary`, `lease_period_totals`, `rent_collected_by_month`)
are all declared `with (security_invoker = on)`, so they run under the policies of whoever selects
from them. Without that one word a view would hand every landlord's totals to anybody who asked, and
`tests/landlordIsolation.test.ts` checks each of the three for exactly that.

---

## 3. Which actions require a session

Twenty server actions exist. Two are public because they have to be; the rest begin with a guard on
their first line, before any input is even parsed.

| Action | File | Requires |
| --- | --- | --- |
| `registerLandlordAccount`, `signIn` | `authenticationActions.ts` | Nothing. These are how a session begins |
| `signOut` | `authenticationActions.ts` | Nothing to check: it ends whatever session the cookie carries, and takes no input |
| `changePassword` | `authenticationActions.ts` | A session of either role, through `getSignedInProfile` |
| `createProperty`, `updateProperty`, `deleteProperty` | `propertyActions.ts` | `requireLandlordProfile` |
| `createUnit`, `updateUnit`, `deleteUnit` | `unitActions.ts` | `requireLandlordProfile` |
| `createLease`, `endLease`, `renewLease` | `leaseActions.ts` | `requireLandlordProfile` |
| `recordRentPayment`, `correctRentPayment` | `rentPaymentActions.ts` | `requireLandlordProfile` |
| `updateMaintenanceRequestStatus` | `maintenanceRequestActions.ts` | `requireLandlordProfile` |
| `submitMaintenanceRequest`, `confirmMaintenanceRequestResolved` | `maintenanceRequestActions.ts` | `requireTenantProfile` |
| `createTenantAccountForLease`, `regenerateTenantPassword` | `tenantAccountActions.ts` | `requireLandlordProfile` |

No action takes a landlord id, a tenant id or any other ownership identifier from its caller. Where
a row needs an owner, the value comes from the guard's return: `createProperty` writes
`landlord_id: landlord.id`, and `recordRentPayment` writes both `landlord_id` and `recorded_by` from
the same source. `tests/serverActions.test.ts` includes two tests under "where ownership comes from"
that submit a payload naming another landlord and then read the row back to confirm which id was
actually stored.

---

## 4. One landlord against another, one tenant against another

**How the policies say it.** Every landlord policy is the same shape: `landlord_id = auth.uid()` in
both `using` and `with check`, so a landlord selects, inserts, updates and deletes only rows carrying
their own id, and cannot insert a row carrying somebody else's. Every tenant policy goes through a
`security definer` helper — `is_current_tenant_lease`, `is_current_tenant_active_lease`,
`is_current_tenant_unit`, `is_current_tenant_property`, `landlord_of_current_tenant_lease` — each of
which answers one question: does this row belong to a lease where the signed-in user is the tenant?
The helpers are `security definer` because a tenant cannot read the `leases` table freely enough to
answer it themselves, and they take an identifier and return a boolean, so they cannot be used to
read anything.

A tenant has exactly two writes anywhere in the product: reporting a problem
(`maintenance_requests_insert_as_tenant`) and confirming that a resolved one really was fixed
(`maintenance_requests_confirm_as_tenant`). The second is narrowed twice over: the policy allows the
update only on their own request, only while its status is `resolved`, and only while
`tenant_confirmed_at` is still null, and the trigger `maintenance_requests_tenant_confirms_only`
then rejects the update if any other column changed. There is no policy anywhere that lets a tenant
write to `leases` or `rent_payments`.

**What a tenant may read of a landlord, and the reverse.** A landlord reads the profile of a tenant
of their own lease (`profiles_select_tenant_of_own_lease`); a tenant reads the name and email of
their own landlord (`profiles_select_landlord_of_own_lease`). Both are scoped through a shared
lease, so neither can enumerate the other's other relationships.

**No tenant URL names a lease.** The tenant portal resolves the tenancy from the session alone.
`src/components/tenant/loadTenantLease.ts` selects from `leases` with no filter naming a lease or a
tenant at all, and Row Level Security returns the one the signed-in user is the tenant of. There is
no identifier in the URL to change, which is why the tenant statement at `/tenant/statement` cannot
be pointed at anybody else's lease.

**What is proved, and where.** The permission suite in `tests/` runs against the test Supabase
project with real credentials and real policies. It refuses to run against production:
`tests/support/testDatabase.ts` compares the project reference from `.env.test` against production's
and throws before a single test executes.

| File | Tests | What it establishes |
| --- | --- | --- |
| `tests/landlordIsolation.test.ts` | 26 | One landlord reads none of another's properties, units, leases, payments, requests, profiles or aggregate views, changes and deletes none of them, and cannot insert a row into another's portfolio. The last three tests do the whole create, read, update and delete cycle on their own rows, so the policies are not merely refusing everything |
| `tests/tenantIsolation.test.ts` | 32 | A tenant reads only their own tenancy and its ledger, cannot reach another tenant's anything, and cannot write to leases or payments by any route including confirming another tenant's repair |
| `tests/anonymousAccess.test.ts` | 12 | The anonymous key, which is in the browser bundle, selects nothing, inserts nothing, updates nothing and deletes nothing anywhere |
| `tests/serverActions.test.ts` | 15 | Actions refuse the wrong role, answer another landlord's identifier exactly as they answer one that does not exist, and stamp ownership from the session rather than from the payload |
| `tests/domainInvariants.test.ts` | 13 | The five domain invariants, including the overlap exclusion constraint that Postgres enforces regardless of application code |
| `tests/schemaGuarantees.test.ts` | 20 | What the schema refuses with the application out of the way: the check constraints, the per-building uniqueness of a flat label, every cascade and restrict the foreign keys declare, and the two triggers |

A refused authorisation and a missing record are deliberately indistinguishable to the caller.
Actions read through the user's own client, so somebody else's row comes back as no rows, and the
answer is "That property was not found" either way. Two tests assert that the wording is identical
in both situations rather than only that both fail.

---

## 5. Validation of what people type

One schema per input, in `src/lib/validation/`, imported by both the form and the action that
receives it. The form runs it through `zodResolver` for immediate feedback; the action runs the same
schema with `safeParse` as the trust boundary. Because there is one definition, the two cannot drift
apart, and because the server parses again, turning off JavaScript changes nothing about what is
accepted.

Every action parses before it does anything else with its input, and a failed parse returns one
message per field through `validationErrorResult` in `src/lib/actionResult.ts`. Identifiers are
`uuidField`, so a malformed id is refused before it reaches Postgres. Money is parsed from text into
whole agorot by `src/lib/money/parseCurrencyInputToCents.ts` rather than trusted as a number, dates
are checked against the calendar and not only against a pattern, and email addresses are trimmed and
lowercased so that one person cannot end up with two accounts differing by capitalisation.

Rules that need the database to answer are checked in the action after parsing, and refused with the
reason next to the field: a lease that overlaps an existing one, a payment for a month outside the
lease, a unit label already used in the same building. Each of those is also a constraint or an
exclusion in the schema, so the check is a better error message rather than the actual guarantee.

Nothing from Postgres is passed to the browser. `unexpectedFailureResult` writes the code and
message to the server log and returns one sentence: "That could not be completed. Try again." A
database message names tables, columns and constraints, and none of that is a browser's business.

---

## 6. How the server actions and the one route handler are protected

A server action is an HTTP endpoint, so it is treated as one. Each begins with the role guard, then
parses its input, then reads or writes through the user's own Supabase client so that Row Level
Security applies to every statement. Nothing about that sequence depends on the page that called it:
a hostile client posting a well-formed payload directly meets the same three things in the same
order. `tests/serverActions.test.ts` is written from exactly that position — it never opens a page,
it calls the database the way a forged request would.

Cross-site posting is covered by two things this project did not have to build: the session cookie
is `sameSite=lax`, so it is not attached to a cross-site form post, and Next.js compares the
`Origin` header against the host for server action requests and rejects a mismatch. Neither is
relied on as the boundary; both sit in front of it.

`/api/health` is the only route handler and the only path the proxy's matcher excludes, because a
scheduler calls it with no session. It is written so that being public costs nothing: it counts rows
in `properties` with `head: true` through the ordinary server client, which has no session, so Row
Level Security matches nothing and the count is always zero. The response is
`{status, database, checkedAt}` and never contains a row, a message from Postgres, or anything about
anybody's portfolio. A failure logs the code on the server and answers 503 with the same three
fields.

---

## 7. Where the secrets are

| Value | Where it lives | Reaches the browser |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local`, `.env.test`, and Vercel's environment | Yes, by design. The anonymous key is public, and `tests/anonymousAccess.test.ts` is the proof that it grants nothing on its own |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local`, `.env.test`, Vercel's environment for production and preview | Never. No `NEXT_PUBLIC_` prefix, so Next.js does not inline it, and `src/lib/supabase/adminClient.ts` imports `server-only`, which turns any attempt to pull it into a client component into a build error |

No `.env` file with real values is in the repository: `.gitignore` covers `.env`, `.env.local`,
`.env.test` and `.env*.local`, and the only tracked one is `.env.example`, which lists names and no
values. The service role client has exactly one caller in the whole codebase,
`src/actions/tenantAccountActions.ts`, and that action checks that the acting landlord owns the
lease — by reading it through their own client, so the policies answer — before the admin client is
constructed. `src/lib/temporaryPassword.ts` and the authentication helpers carry the same
`server-only` import.

---

## 8. Tenant onboarding, and what it costs

There is no email service in this project, which is a decision recorded in `docs/decisions.md` and
not an omission: a student project that depends on a third-party mail provider is a project that
stops working when a trial ends. Everything about onboarding follows from it.

A landlord creates the tenant's account from the lease screen.
`createTenantAccountForLease` confirms the lease is theirs, generates a fourteen-character password
with `node:crypto` from an alphabet that leaves out the characters people misread
(`src/lib/temporaryPassword.ts`), creates the account with `must_change_password: true`, attaches it
to the lease, and shows the password to the landlord once. It is stored nowhere: after that call the
only copy is the hash inside Supabase Auth. If the account cannot be attached to the lease, the
account just created is deleted again rather than left behind as an orphan that can sign in and see
an empty portal. `regenerateTenantPassword` issues a new one for a tenant who has forgotten theirs,
which is this product's entire password reset mechanism.

The tenant's first sign-in is intercepted: `must_change_password` sends them to `/change-password`
from the proxy, and no other route is reachable until `changePassword` clears the flag.

The residual risk is real and worth stating plainly. The temporary password travels out of band,
through whatever channel the landlord already uses to talk to that tenant — a message, a phone call,
a note — and this project has no control over that channel and no record of it. Between creation and
first sign-in the landlord knows a working password for the tenant's account, and nothing detects a
landlord who signs in as their own tenant during that window. The mitigations are that the password
is random rather than derived from anything about the person, that it must be changed before the
portal can be used, and that the landlord can already see everything about that tenancy from their
own side, so the window buys an attacker with the landlord's own credentials very little. It is
narrowed, not closed. An email-based invitation with a single-use link would close it, and that is
the first thing to add if this were ever used for real.

---

## 9. What is still at risk

**The session is a bearer token, and XSS is still the threat that matters.** Making the cookie
HTTP-only stops a script from stealing the session and using it elsewhere, later, from another
machine. It does not stop an injected script from acting as the user inside the page it was injected
into: the browser attaches the cookie to same-origin requests whether or not JavaScript can read it,
so a script could call server actions as the signed-in person for as long as the tab is open. React
escapes what it renders and this project never uses `dangerouslySetInnerHTML`, which is what keeps
injection unlikely; the cookie flags reduce what an injection would be worth rather than preventing
one.

**No rate limiting on this application's own endpoints.** Supabase applies its own limits to the
Auth service — thirty sign-in or sign-up requests per five minutes per IP address, in
`supabase/config.toml` — so password guessing is throttled at the place it happens. Nothing throttles
the server actions. A signed-in landlord could call `createProperty` in a loop, and nothing in this
project would slow them down.

**No multi-factor authentication.** TOTP enrolment and verification are off
(`[auth.mfa.totp]` in `supabase/config.toml`), so a password is the whole of a person's security. For
a landlord managing their own buildings this is the ordinary standard; it would not be enough for a
system holding many landlords' portfolios.

**No audit log.** The database records who wrote a payment (`recorded_by`), who reported a problem
(`submitted_by`) and when any row last changed (`updated_at`, maintained by trigger). That is not an
audit trail: it says who touched a row last, not what it said before, and a corrected payment
overwrites the previous amount with no record of the correction. Nothing records reads at all, so
there is no way to tell after the fact whether a landlord looked at something they should not have.

**Personal data is held, with no lifecycle around it.** Names, email addresses, home addresses, rent
amounts, payment histories and repair reports, which together describe where somebody lives and
whether they pay on time. There is no export, no deletion request path and no retention policy. What
does exist is that deleting a tenant's account leaves the tenancy intact with `tenant_profile_id`
set to null, so removing a person does not destroy the landlord's records, and deleting a landlord's
profile cascades to their entire portfolio.

**Temporary passwords travel out of band**, as described in section 8.

**One trusted administrator.** Anyone with the service role key, or with access to the Supabase
dashboard, can read and write everything. That is true of every application with a database behind
it, and it is worth saying rather than leaving implied.

**Not part of this project's threat model at all:** denial of service, hostile Vercel or Supabase
infrastructure, a compromised developer machine, and the landlord themselves as an attacker against
their own tenants' data, which they can legitimately see all of.
