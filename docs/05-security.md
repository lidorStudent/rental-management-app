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
| Table grants | `20260828193000_anon_may_read_but_not_write.sql` and `20260828203000_anon_may_not_truncate.sql` | The anonymous role may select and nothing else. Postgres checks the grant before it consults a policy, so an anonymous write is refused before Row Level Security is reached at all, and `truncate`, which no policy would have filtered, is refused with it | It is coarse: it knows a role, not a row. It cannot tell one landlord from another |
| Row Level Security | `supabase/migrations/20260825122721_row_level_security.sql` and two later migrations, 29 policies over 6 tables | Decides, inside Postgres, which rows exist for the connection asking | Nothing. This is still the boundary |
| Column rules | `profiles_role_is_immutable`, `maintenance_requests_tenant_confirms_only` | A policy chooses rows, never columns, so these triggers keep a permitted update from touching a column it should not | — |
| Constraints | `supabase/migrations/20260825122011_core_schema.sql` | Overlapping tenancies, negative rent, future receipts and the rest are refused by the schema | They are about correctness rather than permission |

The three aggregate views (`lease_rent_summary`, `lease_period_totals`, `rent_collected_by_month`)
are all declared `with (security_invoker = on)`, so they run under the policies of whoever selects
from them. Without that one word a view would hand every landlord's totals to anybody who asked, and
`tests/landlordIsolation.test.ts` checks each of the three for exactly that.

**On the grants, and what they are and are not.** Supabase grants `anon` and `authenticated` every
privilege on everything in the public schema by default, and Row Level Security is what makes that
safe. It does make it safe: an anonymous client pointed at all six tables and all three views gets
nothing back, and every write it attempts is refused. But it was safe on one mechanism, and a table
shipped one day without a policy would have been world-writable from the moment it was created.
`insert`, `update` and `delete` are now revoked from `anon`, so the outer layer refuses an anonymous
write before a policy is consulted. PERM-36 asserts that per table, and tells the two refusals apart
by their message, since both carry the code `42501`: a policy says "new row violates row-level
security policy", a missing grant says "permission denied for table".

**Row Level Security still carries the boundary.** This is defence in depth and nothing more. It
stops no attack the policies were not already stopping — before the revoke, an anonymous update
returned no error and changed nothing, because no row was visible to change; after it, the same
attempt is refused outright. What it buys is that the policies are no longer the only thing standing
between an anonymous request and the data.

**`select` is deliberately still granted to `anon`.** `/api/health` reads a count of `properties`
with no session at all, on purpose: a scheduler calls it so that a free-plan project is not paused,
and it has to make a real round trip to prove Postgres is answering. The policies answer that read
with nothing, which is why the count is always zero and the endpoint discloses nothing about
anybody's portfolio. Revoking `select` would turn a health check into an error and buy nothing.
PERM-37 asserts that the read still works and still counts zero.

**`authenticated` keeps its write grants, and that is not an oversight.** Every legitimate write in
this product is made by a signed-in user through the client that carries their session, so the
request arrives as `authenticated`. Revoking those grants would not be defence in depth; it would
remove the only path the application has, and Row Level Security is what scopes those writes to the
writer's own rows.

**`truncate` went too, and it was the one that mattered most.** It was left behind at first on the
reasoning that PostgREST exposes no verb reaching it. That reasoning was thin: a policy restricts
which rows a statement sees, and `truncate` does not look at rows, so unlike `delete` it is not
filtered by Row Level Security at all. Of everything `anon` held it was the single write with no
backstop underneath it, which makes it the last one that should have been left. `anon` now holds
`select`, `references` and `trigger`, and nothing that writes.

Proving that needed something to read. PERM-36 asserts its three by attempting them and reading the
refusal; there is no attempt to make for `truncate`, and the catalogue that would answer directly is
not in the exposed schemas — `information_schema` and `pg_catalog` both answer `PGRST205` for the
service role as well as for `anon`. So `anon_write_privileges` exists: a view reporting four
booleans per relation, no data in it, `select` granted to `service_role` alone. PERM-38 reads it and
PERM-39 proves an anonymous caller cannot. The alternative was a security control with nothing
testing it, which is the kind that quietly stops being true.

**One caveat remains, recorded rather than tidied away.** The default privileges that will apply to
*future* tables were revoked only for those granted by `postgres`, which is the role migrations run
as. A default granted by `supabase_admin` remains on the production project and is not alterable
from this connection.

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

## 9. Two columns a profile's owner may not write

`profiles_update_own` lets an account update its own row. That is right for a row that genuinely
belongs to it, and it was two columns too broad. Both were found by attacking the running system
rather than by reading the policy, and both are now refused by
`profiles_self_service_columns_are_pinned`, a `BEFORE UPDATE` trigger in the same shape as
`prevent_profile_role_change` sitting three lines above it in the policy migration.

**`must_change_password`.** This is the value `src/proxy.ts` reads to hold a tenant on
`/change-password` until they replace the temporary password their landlord issued. It lives on the
tenant's own row. Before the trigger, the whole gate came off with one request:

```
sign in with the temporary password   -> lands on /change-password, as intended
PATCH /rest/v1/profiles?id=eq.<self>  {"must_change_password": false}   -> 1 row updated
sign in again, same temporary password -> lands on /tenant
```

The tenant reached only their own data either way, so nothing leaked; what failed was the promise in
section 8 that a tenant must set their own password before using the portal. The same three steps
now stop at the second with `42501`, and the flag is still `true` afterwards.

**`email`.** The landlord reads this to contact their tenant. It is only a copy — the address that
actually signs in lives in `auth.users` and is not reachable from the Data API — so a tenant could
rewrite the copy, leave the landlord looking at an address that reaches nobody, and still sign in
with the real one. Also refused now.

**`full_name` is deliberately still writable.** Nothing in the interface offers editing it, so
pinning it would change no behaviour today, and a person's own name is theirs: refusing it would be
a functional restriction rather than a security fix. DB-24 asserts this so that it reads as a
decision rather than as the trigger having been written carelessly.

**The service role passes through**, exactly as it does in `restrict_tenant_maintenance_update`,
because it has no `auth.uid()`. That is the path `regenerateTenantPassword` takes when a landlord
issues a new temporary password and re-arms the flag, and the path `changePassword` now takes to
clear it once the password really has been replaced. That second one is a change of client:
`changePassword` used to clear the flag with the tenant's own session, which the trigger would
refuse, and a tenant who set a new password would have been trapped on the change-password page
forever. It points the admin client at the id `getSignedInProfile` resolved from the verified
session, never at anything from the form. This makes `src/actions/authenticationActions.ts` the
second caller of the service role client, alongside `src/actions/tenantAccountActions.ts`.

DB-22 and DB-23 are the tests. DB-22 fails without the trigger — it was written that way, and
returned no error code at all before the trigger existed.

---

## 10. Changing a password proves the old one

A session used to be the whole of the requirement. Anybody holding one could set a new password
without knowing the old one, and the real owner was locked out: demonstrated by holding a valid
session for an account whose password was unknown, replacing it, and watching the owner's own
password stop working. `changePasswordSchema` now carries a `currentPassword`, and `changePassword`
proves it before it changes anything.

The proof is a sign-in attempt on `createSupabasePasswordCheckClient()`, a client that holds no
session and writes no cookie. That separation is the point: signing in through the server client
would rotate the caller's own session as a side effect of a check meant to be read-only. The session
the attempt creates is discarded when the function returns, and is deliberately not signed out,
because `signOut()` defaults to revoking every refresh token the user holds and would sign them out
of the browser they are standing in.

There is one path. Nothing about which verification applies is taken from the client, and there is no
branch keyed on `must_change_password`: a tenant replacing a landlord-issued temporary password
proves that temporary password, which they typed to sign in a moment earlier. A conditional field
would have bought a security-relevant branch that has to stay correct forever, to save somebody
retyping a password they are holding.

**Three failures, told apart.** The address is checked against three outcomes rather than one,
because being throttled is not the same as being wrong:

| What happened | What Supabase returns | What the user is told |
| --- | --- | --- |
| The current password is wrong | `400`, `invalid_credentials` | "That is not your current password." — against the field |
| No such account | `400`, `invalid_credentials`, identical | The same, so the form cannot be used to find addresses |
| Too many attempts | `429`, `over_request_rate_limit` | "Too many attempts in a short time. Wait a few minutes and try again; your password has not been changed." |

Those codes were measured, not assumed, and both the status and the code are checked so that a
release which stops setting one still lands on the right message. Getting this backwards would be
worse than the gap it closes: somebody throttled after a typo would be told their password was
wrong and sent to reset a password that was correct all along. PERM-42 asserts that branch.

**The check costs one auth request** against Supabase's thirty per five minutes per address, and a
wrong guess costs one too. The upside is that guessing on this form is throttled by the same limit;
the cost is that somebody fumbling the field repeatedly can briefly throttle themselves, which is
what the third message is for.

**Why Supabase's own `secure_password_change` was rejected**, having been the other candidate:

- **It leaves the demonstrated attack open.** From the installed client's own contract: a user must
  reauthenticate "only if Secure password change is enabled and the user hasn't recently signed in. A
  user is deemed recently signed in if the session was created in the last 24 hours." A stolen
  session is used promptly, which is exactly the exemption. The takeover recorded in the security
  review used a session seconds old and would have succeeded with the setting enabled — which also
  means the review's evidence never proved the setting was what stood in the way.
- **It cannot complete here.** When it does apply, `reauthenticate()` "will send a nonce to the
  user's email... If the user doesn't have a confirmed email address, the method will send the nonce
  to the user's confirmed phone number instead." This project has no mail service by design and no
  SMS provider, and `smtp_host` is null on both Supabase projects. A landlord signed in for more than
  a day would have found their password unchangeable, with nothing in the interface to do about it.
- **The two would conflict if both were on.** They are independent, so a session older than 24 hours
  would need the current-password field *and* an undeliverable nonce, and would fail whatever the
  user typed. Under 24 hours they do not interact. `security_update_password_require_reauthentication`
  is `false` on both projects, confirmed against the Management API before this was built, and is
  deliberately left that way.

One ordering detail worth keeping: clearing `must_change_password` runs after `updateUser`, which
returns early on error, so a verification that started failing would strand a tenant on
`/change-password` forever. PERM-41 covers that path end to end and asserts the redirect at the very
last line of the action, which can only be reached if nothing before it returned early.

---

## 11. The response headers

Built from what the application actually loads, measured rather than copied from a template: every
request the browser makes on this site is same-origin. `next/font` self-hosts Geist at build time,
there is no browser Supabase client so nothing connects to Supabase from the page, and there are no
images, external stylesheets or third-party scripts at all. The policy is set in `next.config.ts`:

```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self';
frame-ancestors 'none'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests
```

alongside `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: same-origin` and a `Permissions-Policy` refusing every device capability, since
this product asks for none. HSTS was already set by the platform.

**`script-src` carries `'unsafe-inline'`, and that is a stated trade.** Next streams the
server-rendered payload into the document as two inline `<script>` blocks. A policy without either
`'unsafe-inline'` or a per-request nonce blocks them, nothing hydrates, and every form on the site
stops working. A nonce is the stronger answer, but it has to be generated per request, which means
moving the policy out of `next.config.ts` and into the proxy — the one file in this project it is
least sensible to complicate. What the policy still buys with the trade made: an injected script
cannot be *loaded* from another origin, and `connect-src 'self'` means an injected script has
nowhere to send what it steals. What is given up is protection against injected *inline* script, and
this application renders no user-controlled HTML anywhere, so React's escaping is the guard that
would have to fail first — which is the same argument the first risk in section 11 makes.

`style-src` carries `'unsafe-inline'` because React writes style attributes onto the elements it
renders. CSS injection is a much weaker vector, and the alternative is rewriting component markup
for no security gain worth the change.

A policy that blocks the application is worse than no policy, so this was verified against a
production build before it was deployed: 23 pages across both portals rendered and hydrated, a form
wrote a row, client-side validation still marked its fields, the printed statement still hid its
chrome and loaded all thirteen font faces, and the browser reported zero policy violations. SEC-01
asserts each directive by name so that a later loosening fails with the name of what was loosened;
SEC-02 signs in and submits a form on the deployed site, because the header being present is not the
same as the page still working.

---

## 12. What is still at risk

**The session is a bearer token, and XSS is still the threat that matters.** Making the cookie
HTTP-only stops a script from stealing the session and using it elsewhere, later, from another
machine. It does not stop an injected script from acting as the user inside the page it was injected
into: the browser attaches the cookie to same-origin requests whether or not JavaScript can read it,
so a script could call server actions as the signed-in person for as long as the tab is open. React
escapes what it renders and this project never uses `dangerouslySetInnerHTML`, which is what keeps
injection unlikely; the cookie flags reduce what an injection would be worth rather than preventing
one.

**The role of a new account is chosen by whoever signs up.** Accepted, after three attempts to fix
it were designed, tested and abandoned. The investigation is written out below because the reasons it
was left are more useful than the finding itself.

`create_profile_for_new_auth_user` copies `role` out of `raw_user_meta_data`, which is the half of
the metadata the client owns: `auth.signUp` stores anything placed in `options.data` verbatim. So a
request straight to the Auth API asking for `role: "landlord"` produces a landlord profile.

*Why it is harmless today.* A landlord account is what `/register` hands to anybody who asks, so
forging one gains nothing that asking politely would not, and it arrives empty. Forging `tenant`
gains less still: a tenant sees rows through `leases.tenant_profile_id`, which only the owning
landlord can set, so a self-declared tenant is attached to no tenancy and sees nothing. Measured
rather than asserted: an account registered asking for `role: "tenant"` signs in successfully, gets a
profile that does say `tenant`, and reads **0 leases, 0 payments and 0 properties**. Underneath
both, every policy in the schema is scoped by ownership as well as role — `landlord_id = auth.uid()`,
never `role = 'landlord'` alone. The application's own `registerLandlordAccount` sets the role
server-side; only a direct API call allows the choice.

*What would make it unsafe.* Any policy that ever grants something on role alone. That is the single
condition, and it is why this is written down rather than left as a curiosity.

*Why hardcoding the role would have been the wrong fix.* Making the trigger always write
`'landlord'` looks like the obvious answer and would have been a privilege escalation of its own.
This trigger is the only place `profiles.role` is ever written, and `prevent_profile_role_change`
refuses a later change to every caller **including the service role** — measured, not assumed: the
service role attempting to correct a role is refused with `42501`. Every tenant created from the
lease flow would have become a landlord, permanently, with no way back short of dropping the
immutability trigger.

*Why the caller cannot be detected inside the trigger.* The natural fix is to trust the metadata only
when the caller is the service role. The trigger cannot tell. The row in `auth.users` is inserted by
the Auth service on its own pooled connection as `supabase_auth_admin`, not by PostgREST carrying
anybody's token, so there is no request context to read. Logged from inside the trigger, both
`admin.createUser` and a public `signUp` produce identical and empty context: `request.jwt.claims`,
`auth.role()` and `auth.jwt()` all null, `current_setting('role')` `none`, `current_user` `postgres`,
`session_user` `supabase_auth_admin`. The two callers are indistinguishable from in there.

*Why `app_metadata` cannot carry it.* `app_metadata` is the half of the metadata a client cannot
write, which makes it the right place for a role — but it arrives too late. GoTrue writes it in a
separate transaction **after** the insert has committed, so the `AFTER INSERT` trigger sees it
absent. Proven rather than inferred: with the role read from `app_metadata`, `admin.createUser`
produced a landlord profile while the row it returned carried
`{"provider":"email","providers":["email"],"role":"tenant"}`; replacing the trigger with a
`CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`, so that it fires at the end of the inserting
transaction, produced the same landlord — which rules out the same-transaction explanation and leaves
only the separate one.

*Why it was left.* Every remaining route reacts to that later update instead of the insert, and every
one of them needs `prevent_profile_role_change` relaxed so that something may set the role after
creation. That guarantee currently holds against every caller including the service role. Trading it
away to close a finding with no impact is a worse position than the one it replaces, so the finding
stays accepted and the reasoning stays here.

Three things were established by testing rather than assumed, and are recorded so that the next
person does not have to rediscover them:

- **GoTrue refuses client-supplied `app_metadata` on `/auth/v1/signup`.** Posting
  `app_metadata: {"role":"tenant"}` with the anonymous key left the stored value as
  `{"provider":"email","providers":["email"]}`, while the `user_metadata` in the same request landed
  untouched. `admin.createUser`, which only the service role can call, sets it.
- **The `user_metadata` attack produces a landlord in every case tested** once the role is read from
  `app_metadata` — including when both metadata types are sent together, which is what shows the old
  path would be genuinely dead rather than merely outranked.
- **`profiles.full_name` is `NOT NULL`**, so a sign-up sending no name makes the trigger's insert fail
  and the whole registration fail. Several apparent escalations in the first attack matrix were
  failed registrations being misread; the rows that actually created a profile all got `landlord`.

**Email addresses are never confirmed.** `enable_confirmations` is off, so anybody can register with
an address they do not own. It cannot be otherwise: there is no email service in this project, which
is the decision section 8 rests on, and confirmation without a way to send mail is not a feature that
can exist here. The effect is bounded — a registration with a stranger's address produces an empty
landlord portfolio and no message is ever sent to that address — but somebody else's address can end
up attached to an account they did not create.

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
