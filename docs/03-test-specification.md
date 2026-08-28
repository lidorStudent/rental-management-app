# Test Specification

Written before the tests, so that the tests are held to this document rather than the document to
the tests.

Every row states one case: what must be true beforehand, what is done, what must happen, where it is
tested, and why it matters. The last column is the point of the whole exercise. A grader reading
only that column should come away knowing what "working" means for this product.

## What "working" means here

This is a record system for a landlord and their tenants. It is working when:

1. **Nobody sees anybody else's data.** This is the first thing to test and the largest section
   below. Everything else is a feature; this is the product's licence to exist.
2. **The rent figures are derived from the ledger and cannot drift.** No status is stored, so no
   status can be stale or wrong.
3. **A unit is never let twice over the same dates**, and that holds under concurrency, not merely
   under careful use.
4. **A refusal explains itself.** A rejected lease says which tenancy is in the way and when the
   unit is free; a rejected delete says how many tenancies are behind it.
5. **A landlord with nothing, and a tenant whose lease ended, both see something sensible.**

## The four levels

| Level | Tool | Runs against | What belongs here |
| --- | --- | --- | --- |
| **U** Unit | Vitest | Nothing. Pure functions | The business rules: overlap, rent status, schedules, transitions, money parsing, dates, pagination |
| **C** Component | Vitest with Testing Library | A rendered component, no server | Forms render their fields, client validation appears, empty states appear |
| **D** Database | Vitest with the Supabase client | The **test** Supabase project, as real signed-in users | Policies, constraints, cascades. The parts that cannot be proved without a real Postgres |
| **E** End to end | Playwright | The running application and the test project | Whole processes through a browser, and the redirects that protect routes |
| **M** Manual | A person | The running application | Print output, visual layout, one-off experiences. Recorded in section 8 |

The D suite lives in `tests/`, runs with `npm run test:db`, and refuses to start if `.env.test`
points at the production project.

**The test project is never the production project.** `.env.test` names
`rental-management-app-test`; the seed refuses to run against production without an explicit flag.
Neither suite reseeds on its own: the D suite expects the seeded portfolio and says so by name when
a seeded row is missing, and every E test builds its own landlord, building and tenant through the
admin API and removes them afterwards, so it depends on nothing the seed wrote.

---

## 1. Core features

Managing the things the product exists to manage. These prove the ordinary path works before
anything clever is asked of it.

### 1.1 Properties and units

| # | Case | Precondition | Action | Expected result | Level | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| CORE-01 | Create a property | Signed in as a landlord | Submit name, street, city, postal code | Property exists, owned by the acting landlord, and its page opens | E | Everything else hangs off a property; nothing works if this does not |
| CORE-02 | Owner is derived, not submitted | Signed in as a landlord | Create a property | `landlord_id` equals the session's user, whatever the payload contained | D | An owner taken from a form is an owner an attacker can choose |
| CORE-03 | Edit a property | A property exists | Change its name and city | The new values are shown on the property page | E | A typo in an address must be fixable without deleting history |
| CORE-04 | Delete a property with no tenancies | A property whose units have never been let | Confirm the delete | Property and its units are gone; the list shows the empty state | E | Removing a mistake must be possible while it is still only a mistake |
| CORE-05 | Add a unit | A property exists | Submit label and bedroom count | Unit appears on the property page as vacant | E | Rent and tenancies attach to a unit, not to a building |
| CORE-06 | Unit occupancy is derived | A unit with an active lease | Open the property page | The unit shows the tenant's name and the end date, with no occupancy column in the database | E | A stored occupancy flag is wrong the moment a lease is ended early |
| CORE-07 | Edit a unit | A unit exists | Change its label | The new label is shown | E | Buildings get renumbered |
| CORE-08 | Delete a unit with no tenancies | A unit never let | Confirm the delete | The unit is gone | E | Same as CORE-04, at the unit level |

### 1.2 Leases

| # | Case | Precondition | Action | Expected result | Level | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| CORE-09 | Record a tenancy | A vacant unit exists | Submit unit, dates, rent, due day, deposit | The lease exists and its page shows the terms | E | The central record of the product |
| CORE-10 | Money is stored as agorot | Signed in as a landlord | Enter a rent of `6,500.50` | `rent_amount_cents` is 650050 | E | A ledger out by an agora is a ledger a tenant can argue with |
| CORE-11 | Tenancy list filters by lifecycle | Leases in all three states | Apply each filter | Only leases matching that state are listed, and the filter is in the URL | E | A landlord opens this list to find what is ending, not to read everything |
| CORE-12 | Create the tenant's account | A lease with no tenant account | Submit the tenant's name and email | An account is created, the temporary password is shown once, and the lease shows the tenant | E | Onboarding with no email service is the product's most unusual decision; it must actually work |
| CORE-13 | The temporary password is shown once | CORE-12 has just run | Reload the lease page | The password is nowhere on the page | E | If it could be shown again it would be stored, and it is not |
| CORE-14 | Reissue a temporary password | A lease with a tenant account | Use "issue a new temporary password" | A new password is shown once, and the tenant must change it at next sign-in | E | With no email there is no self-service reset; this is the reset |
| CORE-15 | End a tenancy early | An active lease | Set an earlier end date | The lease shows the new end date | E | Tenants leave early; the record must follow |
| CORE-16 | Renew a tenancy | A lease near its end | Submit new dates and rent | A second lease exists on the same unit, for the same tenant, with the new rent | E | A renewal is a new agreement, and the history must read that way |

### 1.3 Rent

| # | Case | Precondition | Action | Expected result | Level | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| CORE-17 | Record a payment | An active lease | Submit month, amount, date, method | The payment appears in the history and the month's status changes on its own | E | The single most frequent action in the product |
| CORE-18 | `recorded_by` is derived | Signed in as a landlord | Record a payment | `recorded_by` is the acting user | D | Attribution is what settles a dispute |
| CORE-19 | Correct a payment | A recorded payment | Change its amount | The row keeps its identity, the amount changes, the status follows | E | Corrections must not require deleting evidence |
| CORE-20 | Payment history is newest first and paged | More payments than one page | Open the lease | Ten per page, most recent first, page controls in the URL | E | Three years of history must stay usable |
| CORE-21 | Rent overview across all units | Several tenancies with payments | Open the rent overview | Every tenancy with charged, received and outstanding, arrears first | E | Business goal G4: "how much am I owed" without arithmetic |
| CORE-22 | Statement for a month range | A lease with payments | Open the statement for a range | Charges and payments for that range, with charged, received and balance | E | Deliverable P7: a document a third party can be handed |

### 1.4 Maintenance

| # | Case | Precondition | Action | Expected result | Level | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| CORE-23 | A tenant reports a problem | Signed in as a tenant with an active lease | Submit title, description, urgency | The request exists against their lease and appears on the landlord's list | E | The failure this product exists to fix: problems lost in a chat thread |
| CORE-24 | The lease is derived, not submitted | Signed in as a tenant | Report a problem | `lease_id`, `landlord_id` and `submitted_by` all come from the session | D | A reportable lease id in the payload is another flat a tenant could point at |
| CORE-25 | The landlord moves it along | An open request | Acknowledge, then start work, then resolve | The status changes and `resolved_at` is set on resolution | E | Tracking to resolution is business goal G3 |
| CORE-26 | The tenant confirms the fix | A resolved request on their lease | Confirm | `tenant_confirmed_at` is set and shown to both parties | E | The person in the flat is the one who knows it was fixed |
| CORE-27 | Filter by status and urgency | Requests in several states | Apply both filters | Only matching requests are listed, both filters in the URL | E | "Urgent and still open" is why a landlord opens this page |

---

## 2. Invalid inputs

Every field of every form, with the value that must be refused. Each is checked at the level that
proves it: the server schema is the trust boundary, so most are D or E rather than C.

### 2.1 Registration and sign in

| # | Field | Invalid value | Expected rejection | Level | Why it matters |
| --- | --- | --- | --- | --- | --- |
| INV-01 | `fullName` | `"A"` | "Enter a full name." | C | A lease with an unnamed party is useless |
| INV-02 | `fullName` | 121 characters | "Use at most 120 characters." | U | Matches the check constraint, so the form refuses what the database would |
| INV-03 | `email` | `"not-an-address"` | "Enter a valid email address." | C | It is the sign-in identifier |
| INV-04 | `email` | `"  Maya@Example.CO.IL "` | Accepted, stored as `maya@example.co.il` | U | Two spellings would become two accounts for one person |
| INV-05 | `password` | `"short1A"` | "Use at least 10 characters." | C | Mirrors the policy the Auth service enforces |
| INV-06 | `password` | `"alllowercase123"` | "Include at least one uppercase letter." | U | The same rule, refused before the Auth service refuses it less helpfully |
| INV-07 | `confirmPassword` | Different from `password` | "The two passwords do not match." | C | A typo would lock a landlord out of their own portfolio |
| INV-08 | Sign in | Correct email, wrong password | "That email address and password do not match an account." | E | Must be the same message as an unknown address |
| INV-09 | Sign in | Unknown email | The identical message | E | A different message turns the form into an account-existence oracle |
| INV-10 | Register | An email that already has an account | A message that does not confirm the address exists | E | Same reason as INV-09 |

### 2.2 Property and unit

| # | Field | Invalid value | Expected rejection | Level | Why it matters |
| --- | --- | --- | --- | --- | --- |
| INV-11 | `name` | `" "` | "Give the building a name you will recognise." | C | Trimmed to empty is empty |
| INV-12 | `name` | 121 characters | Refused | U | Matches `properties_name_length` |
| INV-13 | `addressLine` | `"ab"` | "Enter the street and number." | U | Below the check constraint's minimum |
| INV-14 | `city` | `"a"` | "Enter the city." | U | As above |
| INV-15 | `postalCode` | 21 characters | Refused | U | Matches the constraint |
| INV-16 | `postalCode` | `""` | Accepted, stored as null | U | Empty and absent must mean one thing, not two |
| INV-17 | `label` | `""` | "Give the unit a label" | C | A unit nobody can identify cannot have rent recorded against it |
| INV-18 | `label` | Duplicate within one property | "This property already has a unit with that label", against the label field | E | Caught by the unique constraint and turned into a sentence |
| INV-19 | `bedroomCount` | `-1` | Refused | U | Matches `units_bedroom_count_range` |
| INV-20 | `bedroomCount` | `21` | Refused | U | As above |
| INV-21 | `bedroomCount` | `""` | Accepted as "not recorded" | U | Not the same as zero bedrooms |

### 2.3 Lease

| # | Field | Invalid value | Expected rejection | Level | Why it matters |
| --- | --- | --- | --- | --- | --- |
| INV-22 | `startDate` | `"2026-02-30"` | "Enter a date as YYYY-MM-DD." | U | A pattern check alone would accept it |
| INV-23 | `endDate` | Earlier than `startDate` | "The end date must be after the start date." | C | Mirrors `leases_end_after_start` |
| INV-24 | `endDate` | Equal to `startDate` | Refused | U | A single day is a viewing, not a tenancy |
| INV-25 | `rentAmount` | `"0"` | "Enter an amount above zero." | U | There is no rent of nothing |
| INV-26 | `rentAmount` | `"-500"` | Refused | U | Negative rent is a refund, which this product does not record |
| INV-27 | `rentAmount` | `"1.005"` | "Enter an amount such as 6500 or 6500.50." | U | Three decimals is not money |
| INV-28 | `rentAmount` | `"abc"` | Refused | U | Non-numeric input must not become NaN downstream |
| INV-29 | `depositAmount` | `""` | Accepted as zero | U | No deposit is a real answer |
| INV-30 | `depositAmount` | `"-1"` | Refused | U | Matches `leases_deposit_not_negative` |
| INV-31 | `rentDueDay` | `31` | "Choose a day between 1 and 28" | C | February decides this, not the landlord |
| INV-32 | `rentDueDay` | `0` | Refused | U | Matches `leases_rent_due_day_range` |
| INV-33 | `unitId` | A well-formed id of another landlord's unit | "That unit was not found." | E | The ownership case, indistinguishable from a missing unit |
| INV-34 | End a lease | An end date later than the current one | "Ending a lease brings its end date forward" | E | An extension is a renewal, with a new agreement |
| INV-35 | End a lease | An end date on or before the start date | Refused, naming the start date | E | A tenancy cannot end before it began |

### 2.4 Rent payment

| # | Field | Invalid value | Expected rejection | Level | Why it matters |
| --- | --- | --- | --- | --- | --- |
| INV-36 | `amount` | `"0"` | Refused | U | Zero is not a payment |
| INV-37 | `amount` | `"-100"` | Refused | U | Matches `rent_payments_amount_positive` |
| INV-38 | `receivedOn` | Tomorrow's date | "Record money that has arrived, not money you expect." | E | The ledger records receipts, not expectations |
| INV-39 | `receivedOn` | `"2026-13-01"` | Refused as not a date | U | As INV-22 |
| INV-40 | `periodMonth` | A month outside the lease | "That month is outside this tenancy", naming its dates | E | Money against a month with no period would never balance |
| INV-41 | `periodMonth` | `"2026-08-15"` | Refused: a period is named by the first of its month | U | Matches `rent_payments_period_month_is_first_of_month` |
| INV-42 | `method` | `"crypto"` | Refused as not one of the five | U | The enum is the list of ways money arrives here |
| INV-43 | `reference` | 101 characters | Refused | U | Matches the constraint |
| INV-44 | Correct a payment | A payment id belonging to another landlord | "That payment was not found." | E | The ownership case again |

### 2.5 Maintenance and tenant onboarding

| # | Field | Invalid value | Expected rejection | Level | Why it matters |
| --- | --- | --- | --- | --- | --- |
| INV-45 | `title` | `"Ta"` | "Give the problem a short title." | C | A list of two-letter titles is unreadable |
| INV-46 | `description` | `"broken"` | "Describe the problem in a sentence, so it can be acted on." | C | The rule that stops a request being unactionable |
| INV-47 | `description` | 2001 characters | Refused | U | Matches the constraint |
| INV-48 | `urgency` | `"critical"` | Refused as not one of the three | U | Enum again |
| INV-49 | `nextStatus` | `submitted` from `in_progress` | "A request that is in progress can only become resolved" | E | The transition map, enforced on the server |
| INV-50 | `tenantEmail` | An address that already has an account | A message that does not confirm the address exists | E | A landlord may know an address will not work; they may not learn who else uses this product |
| INV-51 | `tenantFullName` | `"A"` | Refused | C | The tenant's name appears on the lease and the statement |
| INV-52 | Statement range | `?from=not-a-month` | The default range, not an error page | E | A bookmark that has gone stale is not a fault |

---

## 3. Central business processes

The three journeys the product is for. These are the tests that must exist even if every other test
were dropped.

### 3.1 The lease lifecycle

| # | Case | Precondition | Action | Expected result | Level | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| PROC-01 | Empty portfolio to a let unit | A landlord who has just registered | Add property, add unit, record a tenancy, create the tenant account | Each step leads to the next, and the unit ends up showing the tenant's name | E | The first hour with the product, end to end |
| PROC-02 | The tenant signs in with the temporary password | PROC-01 has run | Sign in as the tenant | Forced to `/change-password` and cannot leave until a new password is set | E | The onboarding decision only works if the forced change works |
| PROC-03 | The tenancy ends early | An active lease | End it with an earlier date | The lease reads as ended once that date passes; the unit reads as vacant | E | Tenants leave early, and occupancy must follow without a flag |
| PROC-04 | The tenancy is renewed | A lease with an end date | Renew from the day after it ends | Two leases exist, back to back, and neither conflicts with the other | E | The commonest lifecycle event after the first one |
| PROC-05 | The renewal cannot start too early | As PROC-04 | Renew starting on the current end date | Refused, naming the tenancy and the first free day | E | The boundary rule, in the flow where it is actually met |

### 3.2 The rent lifecycle, including a month going overdue

| # | Case | Precondition | Action | Expected result | Level | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| PROC-06 | A period before its due date | A lease with rent due on the 10th | Derive status on the 1st with nothing paid | `due` | U | The starting state of every month |
| PROC-07 | A period part paid before its due date | As above | Pay half on the 5th, derive on the 5th | `partial`, with the remainder shown | U | Part payments are the case landlords track worst on paper |
| PROC-08 | A period fully paid | As above | Pay in full, derive any time after | `paid` | U | The ordinary happy month |
| PROC-09 | **A month goes overdue** | As above, nothing paid | Derive on the 11th | `overdue` | U | The product's reason for existing: noticing in days rather than weeks |
| PROC-10 | Part paid and past due | As above, half paid | Derive on the 11th | `overdue`, not `partial`, with the remainder shown | U | The landlord needs it in the chase list; the amount says how much |
| PROC-11 | Overdue shows on the lease page | A lease with an unpaid past month | Open the lease | The month is called out above the schedule and marked in it | E | A status nobody can see is not a status |
| PROC-12 | Overdue reaches the dashboard | As above | Open the dashboard | Outstanding is non-zero and links to the rent overview | E | Business goal G2, at the place a landlord actually looks |
| PROC-13 | Recording a payment clears it | As PROC-11 | Record the outstanding amount | The month reads `paid` and the dashboard total falls | E | The whole loop, closed |
| PROC-14 | The tenant sees the same thing | As PROC-13 | Sign in as the tenant | The same status and the same payment, with no action by the landlord | E | Business goal G5: the landlord stops being a message router |
| PROC-15 | Overpayment | A lease with one month charged | Pay more than the rent | `paid`, with the surplus shown as credit and no error | U | Overpayment is real; refusing it would be wrong |

### 3.3 The maintenance lifecycle

| # | Case | Precondition | Action | Expected result | Level | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| PROC-16 | Report, acknowledge, work, resolve, confirm | An active lease | The tenant reports; the landlord moves it through; the tenant confirms | Each status is visible to both parties at every step, and `resolved_at` and `tenant_confirmed_at` are set | E | The full journey the product replaces a chat thread with |
| PROC-17 | Reopening clears the confirmation | A confirmed resolved request | The landlord reopens it | Status is in progress, `resolved_at` and `tenant_confirmed_at` are null | D | A reopened problem is not one the tenant agreed was finished |
| PROC-18 | The transition map is the only route | Requests in each status | Attempt every status pair | Only the pairs in `ALLOWED_MAINTENANCE_STATUS_TRANSITIONS` succeed | U | One constant decides, so the buttons and the server cannot disagree |

---

## 4. Permissions

The most important group. Every row here is a way the product could fail in the way that matters
most. Most are tested at D, against real policies with real sessions, because that is where the
guarantee lives; the redirects are tested at E because that is where a person meets them.

### 4.1 Landlord against landlord

| # | Case | Precondition | Action | Expected result | Level | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| PERM-01 | Read another landlord's properties | Two landlords with portfolios | Landlord B selects properties | Only their own | D | The basic isolation claim |
| PERM-02 | Read another landlord's units | As above | Select units | Only their own | D | As above |
| PERM-03 | Read another landlord's leases | As above | Select leases, and by explicit id | Empty, both ways | D | An id in a URL must buy nothing |
| PERM-04 | Read another landlord's ledger | As above | Select rent payments | Only their own | D | Their income is not anyone else's business |
| PERM-05 | Read another landlord's requests | As above | Select maintenance requests | Only their own | D | As above |
| PERM-06 | Edit another landlord's lease | As above | Update by id | Zero rows changed | D | Read isolation without write isolation is worthless |
| PERM-07 | Delete another landlord's unit | As above | Delete by id, through the action | "That unit was not found", and the unit still exists | E | The action's answer and the database's answer must agree |
| PERM-08 | Plant a unit in another landlord's property | As above | Insert a unit naming their property | Refused by `units_insert_own` | D | The obvious way to get a row into someone else's portfolio |
| PERM-09 | Record a payment on another landlord's lease | As above | Call the action with that lease id | "That lease was not found", and no row is written | E | The ownership check and the policy, in one test |
| PERM-10 | Read another landlord's aggregates | As above | Select `lease_rent_summary` | Only their own rows | D | A view without `security_invoker` would leak everything |
| PERM-11 | Another landlord's statement | As above | Open the statement route by lease id | The not-found page | E | The statement is a document; it must be no easier to reach than the data in it |

### 4.2 Tenant against tenant

| # | Case | Precondition | Action | Expected result | Level | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| PERM-12 | Read another tenant's lease | Two tenants of one landlord | Select leases, and by explicit id | Only their own, both ways | D | Two tenants of the same landlord is the case most likely to leak |
| PERM-13 | Read another tenant's payments | As above | Select rent payments | Only their own lease's | D | What someone else pays is not their business |
| PERM-14 | Read another tenant's requests | As above | Select maintenance requests | Only their own | D | Reports name rooms and habits |
| PERM-15 | Open another tenant's request page | As above | Visit the request URL with the other's id | The not-found page, byte for byte identical to a request that does not exist | E | A different page would confirm the request exists |
| PERM-16 | Confirm another tenant's resolution | As above | Update that request | Zero rows changed | D | The tenant's one write must be as narrow as it looks |
| PERM-17 | Report against another tenant's lease | As above | Insert naming their lease | Refused by `maintenance_requests_insert_as_tenant` | D | The insert policy checks the lease, not the payload |
| PERM-18 | Report in another person's name | As above | Insert with a different `submitted_by` | Refused | D | Attribution cannot be forged |
| PERM-19 | See another tenant exists | Signed in as a tenant | Read profiles, units, properties | Own profile and own landlord only; one unit; one building | D | The product must not reveal that other tenants exist at all |

### 4.3 A tenant attempting landlord actions

| # | Case | Precondition | Action | Expected result | Level | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| PERM-20 | Write to the ledger | Signed in as a tenant | Insert, update and delete rent payments | All refused | D | Domain invariant 5: the ledger is the landlord's record |
| PERM-21 | Change their own lease | As above | Update their lease's end date or rent | Zero rows changed | D | A tenant who could extend their own tenancy is not a tenant |
| PERM-22 | Create a lease | As above | Insert a lease | Refused | D | Only a landlord lets a unit |
| PERM-23 | Change a request's status | As above | Update status | Refused | D | Only the landlord says the work is done |
| PERM-24 | Smuggle a field while confirming | A resolved request of theirs | Update `tenant_confirmed_at` and the title together | Refused by the trigger | D | A policy restricts rows, never columns; the trigger is what restricts columns |
| PERM-25 | Promote themselves | Signed in as a tenant | Update their own `role` to landlord | Refused by `profiles_role_is_immutable` | D | The one row a tenant may write is their own profile |
| PERM-26 | Reach the landlord area | Signed in as a tenant | Visit `/landlord`, `/landlord/rent`, a lease page | Redirected to `/tenant` every time | E | Routing is not the boundary, but it must still hold |
| PERM-27 | No landlord links leak | Signed in as a tenant | Read every link on every tenant page | None points at `/landlord` | E | The portal must not advertise a door it will not open |

### 4.4 The signed-out visitor

| # | Case | Precondition | Action | Expected result | Level | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| PERM-28 | Protected routes | No session | Visit `/`, `/landlord`, `/tenant`, a lease page, a statement, a made-up path | Redirected to `/login` in every case | E | "Every route except two" must be literally true |
| PERM-29 | The two public routes | No session | Visit `/login` and `/register` | Both render | E | The exceptions are exactly two |
| PERM-30 | The anonymous key grants nothing | No session | Select from every table with the public key | Zero rows everywhere | D | The key is in the browser; this is why that is safe |
| PERM-31 | An account with no profile row | An Auth user whose profile is missing | Sign in | Signed out again and returned to `/login` with an explanation | E | An account with no role has no area, and must not be given one |

### 4.5 The session cookie itself

The cookie is the thing every permission above depends on, and `@supabase/ssr` writes it without the
HTTP-only flag by default so that its browser client can read the session back out of
`document.cookie`. This project overrides that in `src/lib/supabase/sessionCookieOptions.ts`, which
is a departure from a library default and so needs a test that fails if the default returns.

| # | Case | Precondition | Action | Expected result | Level | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| PERM-32 | The cookie is closed to script | A landlord signs in | Read `document.cookie` in the page | Empty of any token, and the cookie is `httpOnly`, `sameSite=Lax`, `secure` when the address is HTTPS | E | The cookie holds the refresh token; a script that could read it could keep the session alive after the page closed |
| PERM-33 | The same for a tenant | A tenant signs in | As above, then load a page needing the session | Unreadable by script, still readable by the server | E | A protected session that no longer works is a broken one, not a safe one |
| PERM-34 | An expired access token is refreshed | A signed-in tenant whose cookie claims an expired token | Load `/tenant` | The page renders signed in and the cookie is replaced | E | The flags must not break the refresh the proxy exists to perform |
| PERM-35 | The flags on the deployed site | The deployed address | Sign in as the seeded landlord and the seeded tenant | `httpOnly`, `secure` and `sameSite=Lax` are all true there | E | `secure` only turns on in a production build, so this is the only place its real value can be seen |

---

## 5. Database

The guarantees that survive a mistake in application code. All at D, because none of them can be
proved anywhere else.

| # | Case | Precondition | Action | Expected result | Level | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| DB-01 | **Overlap is refused by Postgres** | A lease on a unit | Insert an overlapping lease with the service role, bypassing every application check | Rejected with `23P01` | D | Domain invariant 1. If this passes, the application checks are a convenience; if it fails, they are the only thing standing |
| DB-02 | Touching at the end date counts as overlap | A lease ending 2026-05-31 | Insert one starting 2026-05-31 | Rejected | D | The endpoint rule the whole product is built on |
| DB-03 | The day after does not | As above | Insert one starting 2026-06-01 | Accepted | D | The other half of DB-02, so the rule is not merely "always refuse" |
| DB-04 | Rent must be positive | — | Insert a lease with `rent_amount_cents` of 0 | Rejected | D | The constraint behind INV-25 |
| DB-05 | End after start | — | Insert a lease ending before it starts | Rejected | D | The constraint behind INV-23 |
| DB-06 | Due day within 1 to 28 | — | Insert with 31 | Rejected | D | The constraint that removes month-length arithmetic |
| DB-07 | Payment must be positive | — | Insert a payment of 0 | Rejected | D | The ledger's integrity |
| DB-08 | Payment not in the future | — | Insert with tomorrow's `received_on` | Rejected | D | Receipts, not expectations |
| DB-09 | Period month must be a first | — | Insert with `2026-08-15` | Rejected | D | How a payment names a derived period |
| DB-10 | Unit label unique per property | A unit labelled "Flat 1" | Insert another "Flat 1" in the same property | Rejected with `23505` | D | The constraint behind INV-18 |
| DB-11 | The same label in another property | As above | Insert "Flat 1" in a different property | Accepted | D | The uniqueness is per building, not global |
| DB-12 | Resolution date pairs with status | — | Insert resolved with a null `resolved_at`, then in progress with a date | Both rejected | D | "Resolved" and "has a resolution date" are one fact |
| DB-13 | Confirmation requires resolution | — | Set `tenant_confirmed_at` on an open request | Rejected | D | A confirmation of nothing |
| DB-14 | **Cascade: account to profile** | An Auth user with a profile | Delete the Auth user | The profile goes with it | D | A profile describing nobody is a row that outlives its meaning |
| DB-15 | **Cascade: landlord to portfolio** | A landlord with properties and units | Delete the profile | Properties and units go with it | D | Ownership never transfers, so nothing should be left ownerless |
| DB-16 | **Restrict: unit with a lease** | A unit that has been let | Delete the unit | Rejected with `23503` | D | The ledger hangs off the lease, which hangs off the unit |
| DB-17 | **Restrict: lease with payments** | A lease with a payment | Delete the lease | Rejected | D | Evidence is not deleted to tidy up |
| DB-18 | **Set null: tenant account removed** | A lease with a tenant | Delete the tenant's account | The lease survives with `tenant_profile_id` null | D | A tenancy is a fact about a unit, not about a login |
| DB-19 | **Restrict: reporter of a request** | A tenant who has reported a problem | Delete their account | Rejected | D | Who reported it is part of the record |
| DB-20 | `updated_at` maintained by trigger | Any row | Update it without setting `updated_at` | The column moves anyway | D | A column no code has to remember is a column that is always true |
| DB-21 | Profile created by trigger | — | Create an Auth user with role metadata | The profile row exists with that role | D | An account can never exist without a role |
| DB-22 | Aggregates respect policies | Two landlords | Select the three views as each | Only their own rows, both times | D | `security_invoker` is one word, and everything depends on it |
| DB-23 | **Pinned against their owner** | A tenant on a temporary password | Clear `must_change_password`, then rewrite `email`, on their own row | Both rejected with `42501`; the flag is still true and the address unchanged | D | The flag is the forced-change gate and the address is what the landlord reads; both lived on a row their subject could write |
| DB-24 | The service role still sets them | Any account | Set and clear `must_change_password` with the service role | Both succeed | D | That is how a landlord re-arms it and how the change-password action clears it |
| DB-25 | `full_name` is left writable | Any account | Rename themselves | Accepted | D | Asserts a decision: nothing in the interface offers it, and a person's own name is theirs |

---

## 6. Edge cases

| # | Case | Precondition | Action | Expected result | Level | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| EDGE-01 | **The exact boundary date** | A lease running to 2026-05-31 | Propose one starting 2026-05-31 | Refused, naming 2026-06-01 as the first free day | U and E | The single most consequential rule in the product |
| EDGE-02 | The day either side of the boundary | As above | Propose 2026-05-30 and 2026-06-01 | Refused, then accepted | U | Proves the rule is a boundary and not a blanket refusal |
| EDGE-03 | An edit does not conflict with itself | An existing lease | Shorten it | Accepted; the lease is excluded from its own check | U and E | Without this, no lease could ever be changed |
| EDGE-04 | **A partial payment** | A month charging 6500 | Pay 2500 before the due date | `partial`, remainder 4000 shown as a figure | U and E | "Part paid" without an amount tells a landlord nothing |
| EDGE-05 | **A lease ending today** | A lease whose end date is today | Read its lifecycle and its unit's occupancy | Still active, still occupied | U | Both endpoints belong to the tenant, including the last day |
| EDGE-06 | A lease starting today | A lease starting today | As above | Already active | U | The other endpoint |
| EDGE-07 | **A tenant with no active lease** | A tenant whose lease ended | Open every tenant page | History still readable; reporting refused with the end date explained; no error page | E | Their history is theirs, and an error page would say something is broken |
| EDGE-08 | A tenant whose lease has not started | A lease starting next month | As above | Told when it starts; reporting refused | E | An ordinary state, not a fault |
| EDGE-09 | A tenant with no lease at all | An account with no tenancy | Open the portal | An explanation, not an empty page or a crash | E | Accounts exist before tenancies do |
| EDGE-10 | **A landlord with no properties** | A landlord who just registered | Open dashboard, properties, leases, rent, maintenance | Every page shows what to do next; no table is rendered | E | The first screen a new user sees |
| EDGE-11 | **A payment for a future month** | A lease running into next year | Record a payment for a month whose due date has not passed | Accepted; the month reads `paid`, and outstanding does not go negative for periods not yet charged | U and E | Paying ahead is normal and must not look like an error |
| EDGE-12 | A payment received in the future | Any lease | Record with tomorrow's date | Refused at the schema and at the constraint | E and D | The difference between paying ahead and pretending |
| EDGE-13 | Rent due on the 28th in February | A lease with due day 28 | Build the schedule across February | Every month has a due date, including a non-leap February | U | Why the due day is capped at 28 |
| EDGE-14 | A month with no rows in a statement | A range before the tenancy | Open the statement | An explicit empty statement, not a blank page | E | A blank document looks broken |
| EDGE-15 | A page number past the end | A short list | Ask for `?page=99` | Redirected to the first page, not shown an empty state | E | A stale bookmark must not claim the list is empty |
| EDGE-16 | A page number that is not a number | Any list | Ask for `?page=abc` | Treated as page 1 | U | The URL is user input |
| EDGE-17 | Two part payments in one month | A month charging 6500 | Record 3000 and 3500 | The month reads `paid` and both rows remain in the history | E | The commonest real ledger shape |
| EDGE-18 | A tenancy with no tenant account | A lease recorded before onboarding | Open the lease and the unit | Both read "no tenant account yet" rather than breaking | E | The lease exists before the account does, by design |

---

## 7. Basic UI

| # | Case | Precondition | Action | Expected result | Level | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| UI-01 | Every form renders its fields | — | Render each form | Labels, hints and the submit button are present and associated with their inputs | C | A field without a label is unusable with a screen reader |
| UI-02 | Client validation appears | A rendered form | Submit it empty | A message under each invalid field, and no request made | C | The fast feedback the schema is shared for |
| UI-03 | Server refusals appear | A form that will be refused | Submit a duplicate unit label | The message appears above the form and against the label field | E | A refusal the user cannot see is a form that silently does nothing |
| UI-04 | Empty states appear | A landlord with no properties, a tenant with no requests | Open each list | A titled empty state naming the next action | E | Requirement of the product specification: never a blank area |
| UI-05 | Pagination works | More rows than one page | Page forward and back | The right rows, the count line, and the page number in the URL | E | Long histories are the normal case after a year |
| UI-06 | Pagination keeps its filter | A filtered list with two pages | Page forward | The filter survives in the URL | E | Losing the filter on page two makes the filter pointless |
| UI-07 | The active navigation link is marked | Signed in | Visit each area page | `aria-current="page"` on the matching link | E | Orientation, and it is one line to get wrong |
| UI-08 | Loading states are skeletons | A slow section | Load a page | A skeleton the shape of the content, not a spinner over the page | M | Judged by eye; see MAN-02 |
| UI-09 | Tenant navigation is the tenant's | Signed in as a tenant | Read the navigation | Four links, none of them a landlord route | E | Also a permission test, from the other side |
| UI-10 | Destructive actions confirm | A deletable unit | Click delete | A panel naming the consequence before anything happens | E | Deleting a building should take two decisions |
| UI-11 | Print media hides the chrome | A statement page | Emulate print media | Navigation, buttons and the range form are hidden; the document is not | E | The half of printing a machine can judge |
| SEC-01 | Security headers are sent | The deployed address | Read the response headers | CSP with every directive named, plus X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy | E | Only the deployed address proves what the platform actually sends |
| SEC-02 | The policy does not break the pages | The deployed address | Sign in and submit a form | Both work, and the browser reports no refusal | E | A policy that blocks the application is worse than no policy |

---

## 8. Documented manual tests

Automation is worth its cost when a machine can judge the result. These cases are judged by eye, or
happen once per account, and the effort of automating them would buy less than the effort of running
them carefully before submission.

Record the outcome and the date in the table under each one.

### MAN-01 The print stylesheet

**Why manual.** A browser test can assert that the navigation is hidden in print media, and UI-11
does exactly that. What it cannot judge is whether the printed document looks like a document:
margins, page breaks in sensible places, nothing clipped. That is a person looking at a PDF.

**Steps**

1. Sign in as `noa.bendavid@example.co.il` and open a tenancy with at least a year of payments.
2. Click **Statement**, set the range to the whole tenancy, and click **Print or save as PDF**.
3. In the print preview, check: no navigation bar, no buttons, no range form.
4. Check the page margins are even and nothing is cut off at the right edge.
5. Check no table row is split across two pages, and no section heading is left alone at the bottom
   of a page.
6. Save as PDF and open the file.

**Expected.** A two or three page document beginning with "Rent statement", the property and unit,
both parties, the lease terms, the charges, the payments, and the summary. Readable in black and
white.

| Run on | By | Browser | Outcome | Notes |
| --- | --- | --- | --- | --- |
| 2026-08-26 | Claude, with the developer | Chromium 151 | **Pass** | Printed the full thirteen-month statement for the ended tenancy on Flat 3 to a two-page A4 PDF. No navigation, no buttons, no range form. Margins even at 16mm, nothing clipped at the right edge. The payments table broke across the page with its header repeated and no row split, and the summary block stayed whole on page two. Readable in black and white |
| 2026-08-27 | Claude | Chromium 151 | **Pass** | Re-printed after the theme change, from the deployed site rather than a local build. The same thirteen-month statement for Flat 3 came out as a two-page A4 PDF of 88 KB. No navigation, no buttons, no range form; margins even at 16mm and nothing clipped. The payments table broke across the page with its header repeated on page two and no row split; the summary and the footer stayed whole. The statement carries no status badge by design, so the greyscale check was made where the badges live: under print media the five meanings measure 1.000, 1.000, 0.905, 0.842 and 0.089 in relative luminance, with a dashed border on the first and weights from 400 to 600, so they stay apart on a black and white printer |

### MAN-02 Visual layout at different window sizes

**Why manual.** Screenshot comparison tests are the classic example of a test that fails for
reasons nobody cares about. A person can tell the difference between "wrapped differently" and
"broken" in a second; a machine cannot without constant maintenance.

**Steps**

1. Sign in as a landlord and visit the dashboard, properties, a property, leases, a lease, rent, and
   maintenance.
2. At each page, resize the window to roughly 1440, 1024, 768 and 375 pixels wide.
3. At 375 pixels, check every table scrolls sideways within its own border rather than pushing the
   page sideways.
4. Check the navigation stays usable and nothing overlaps.
5. Reload a page with a slow connection simulated, and watch what appears first: the page frame with
   a skeleton the shape of the content, not a spinner over everything. This is UI-08.
6. Repeat for the tenant portal.

**Expected.** Every page readable at every width. Tables scroll inside their frames. No text is cut
off and no control is unreachable.

| Run on | By | Widths checked | Outcome | Notes |
| --- | --- | --- | --- | --- |
| 2026-08-26 | Claude, with the developer | 1440, 1024, 768, 375 | **Pass, after a fix** | At 375 pixels the landlord navigation pushed the page sideways by 10 pixels, because its five links could not wrap. Fixed by letting the link row wrap; both navigations now do. Rechecked at all four widths: no page scrolls sideways, tables scroll inside their own frames, nothing overlaps and no control is unreachable |
| 2026-08-27 | Claude, by script | 1440, 1024, 768, 375 | **Pass, machine half only** | Re-run because the page padding changed from `px-4 py-6` to `px-6 py-8` and the table cells from `p-2` to `px-4 py-2.5`. A script signed in as a landlord and compared `scrollWidth` against `clientWidth` on the dashboard, properties, leases, rent, maintenance, one lease and one property: no page pushes the document sideways at any of the four widths. The half a machine cannot judge - whether it reads well, and the tenant portal - still wants the by-eye pass before submission |
| 2026-08-27 | The developer | 1440, 1024, 768, 375 | **Pass** | The by-eye half, on the deployed site. Both portals walked, including the tenant portal at the narrow widths. Everything reads well; nothing overlaps, nothing is cut off, and no control is unreachable |

### MAN-03 The first sign-in experience for a new tenant

**Why manual.** The mechanics are covered by PROC-02 at end-to-end level. What is not automatable
is whether a person who has never seen this product understands what the temporary password is, that
it will not be shown again, and what they are being asked to do. That is a judgement about wording.

**Steps**

1. As a landlord, create a tenant account on a lease and read the panel that appears.
2. Copy the password, then dismiss the panel and confirm it cannot be shown again.
3. In a private window, sign in as the tenant with that password.
4. Read the page you land on without clicking anything. Try to navigate away.
5. Set a new password and continue.

**Expected.** At every step it is clear what to do next and why. The landlord understands they must
pass the password on. The tenant understands they must choose their own, and cannot reach anything
else until they do.

| Run on | By | Outcome | Notes |
| --- | --- | --- | --- |
| 2026-08-26 | Claude, with the developer | **Pass** | The panel reads: "Give this password to your tenant now. It is shown once and cannot be shown again. Nothing stores it, not even this application, so if it is lost you will have to issue a new one. Send it to <address> however you normally talk to them. They must choose their own password the first time they sign in." Password shown in monospace with a copy control and an "I have given it to them" button. Signing in as the tenant lands on the change-password page, which says the landlord created the account with a temporary password, and navigating elsewhere returns there. The wording judgement is one the project owner may wish to confirm for themselves |

### MAN-04 Keyboard and screen reader pass

**Why manual.** Automated checks catch missing labels, which UI-01 does. Whether the resulting
experience is usable is not something an assertion can decide.

**Steps**

1. From the sign-in page, complete a whole flow using only the keyboard: sign in, add a property,
   add a unit, record a tenancy.
2. Check the focus outline is visible at every step and the tab order follows the visual order.
3. Turn on the operating system screen reader and read one form and one table.

**Expected.** Every control reachable and operable by keyboard. Fields announce their label and
their error. Tables announce their caption.

| Run on | By | Assistive technology | Outcome | Notes |
| --- | --- | --- | --- | --- |
| 2026-08-26 | Claude, with the developer | Keyboard only | **Pass, keyboard half** | Signed in and reached the property form using only Tab and Enter. Tab order follows the visual order: navigation, then the back link, then the form fields in the order shown, then the submit button. The focus ring is visible at every stop. Every field announces its label, which UI-01 also asserts |
| 2026-08-26 | The project owner | VoiceOver on macOS | **Failed, then fixed** | Reading a field that had failed validation announced nothing about the error: the message was rendered under the input but not associated with it, so a reader heard the label and "invalid data" and was never told what was wrong. Fixed by giving each message an id and pointing the input at it with aria-describedby, alongside the hint where there is one. Covered from now on by src/components/forms/TextField.test.tsx, which asserts the accessible description of a field in each of the three field types |
| 2026-08-26 | The project owner | VoiceOver on macOS | **Pass** | Re-run after the fix. A field that failed validation now announces its label, that the value is invalid, and the message itself. The rent table is found through the rotor under Tables, named by its caption, and rows read across with their column headers |
| 2026-08-27 | Claude, by script | Keyboard only | **Pass** | Re-run across both portals after the theme and control changes, by tabbing through 19 screens and measuring every stop 500ms after the key, so the button's 150ms ring transition had settled. 201 focus stops: 198 carry a visible indicator, and 0 depart from the visual order. The other 3 are the calendar button Chromium puts inside `<input type="date">`, which is browser shadow DOM: `:focus-visible` stops matching on the host input, the browser draws its own indication, and no application style reaches it. The date segments themselves each carry the ring. **A defect was reported against the primary button and there is none**: a first measurement read `box-shadow` at the instant of focus, before the button's `transition-all` had drawn the ring. Measured after it settles, the button carries the same 3px accent ring as an input. The 2026-08-26 note above was right and is left standing |

### MAN-05 Deployment smoke test

**Why manual.** It runs against production, once per deployment, and its value is a person
confirming the real thing works at its real address.

**Steps**

1. Open the live URL in a private window. Confirm it redirects to sign in.
2. Sign in as the seeded landlord. Confirm the dashboard figures are not zero.
3. Open one lease, one statement, and the maintenance list.
4. Sign out, sign in as a seeded tenant, and confirm the portal loads.

**Expected.** Every page loads without error at the deployed address, with real data.

| Run on | By | Deployment | Outcome | Notes |
| --- | --- | --- | --- | --- |
| 2026-08-26 | Claude, with the developer | https://rental-management-app-wine.vercel.app | **Pass** | The root redirects to sign in. Signed in as the seeded landlord: the dashboard figures are populated, occupancy is not zero. Opened a tenancy, its statement and the maintenance list. Signed out, signed in as a seeded tenant, and the portal loaded. Read only: nothing was written to the deployed project |
| 2026-08-26 | Claude | https://rental-management-app-wine.vercel.app | **Pass** | Re-run with the exact credentials printed in `README.md`. `noa.bendavid@example.co.il` landed on `/landlord` showing ₪2,500.00 collected this month from one payment, ₪13,000.00 outstanding, three open problems and occupancy of 2 of 5. `maya.levi@example.co.il` landed on `/tenant` showing Flat 1, Rothschild Boulevard 12. Read only |
| 2026-08-27 | Claude | https://rental-management-app-wine.vercel.app | **Pass** | Re-run after the audit fixes and a fresh production deployment. Health check 200; the automated companion's five checks all passed, including both seeded roles signing in and the cookie's flags. Read only |
| 2026-08-27 | Claude | https://rental-management-app-wine.vercel.app | **Pass** | Re-run after the theme deployment with `PLAYWRIGHT_BASE_URL` set, so the five checks executed rather than skipped: all five passed in 26.1s. Two things were confirmed on the deployed site by hand at the same time. The computed `font-family` on a rendered page is `Geist, "Geist Fallback"`, which is the self-referencing `--font-sans` fixed in production and not only locally. The session cookie is `httpOnly`, `secure`, `sameSite=Lax`, and `document.cookie` reads as the empty string to page script. Read only |
| 2026-08-27 | Claude | https://rental-management-app-wine.vercel.app | **Pass** | Re-run after the functions were moved to `fra1`, with `PLAYWRIGHT_BASE_URL` set: all five passed in **14.5s**, against 26.1s for the same five checks earlier the same day. The deployed site reports `x-vercel-id: fra1::fra1` where it reported `fra1::iad1` before, so the function now runs in the same city as the database. Both seeded roles signed in and reached their pages; the cookie's flags are unchanged. Read only |
| 2026-08-28 | Claude | https://rental-management-app-wine.vercel.app | **Pass** | Re-run after the security fixes, with `PLAYWRIGHT_BASE_URL` set. The suite is now **seven** checks rather than five: SEC-01 and SEC-02 join it, asserting the response headers and then that the policy does not stop a page working. All seven passed in 19.3s. The content security policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy and Permissions-Policy are all served, on pages and on `/api/health` alike. Both seeded roles signed in and reached their pages. Read only |

**The automated companion, and why it is skipped by default.** `e2e/deploymentSmoke.spec.ts`
performs steps 1 to 4 of this case in a browser, and also carries SEC-01 and SEC-02, the two checks
on the response headers, which can only be made where the platform actually serves them: seven tests
in all. The file begins with a `test.skip` that skips all seven unless `PLAYWRIGHT_BASE_URL` is set,
which is why an ordinary `npm run test:e2e` reports twenty-two passed and seven skipped. That is a deliberate decision, for three reasons: the file
reads the deployed project, which serves the demo data people are shown, while every other E test
creates and deletes rows in the test project, so one run must not point at both; the session
cookie's `secure` flag is only set when `NODE_ENV` is `production`, so asserting it against a
development server would assert something false; and this is a check to run after a deployment
rather than before a merge.

Nothing in this repository is skipped for any other reason. There is exactly one `test.skip` in the
whole project, the one above, and no `test.fixme`, no `describe.skip` and no `.only`. No test is
skipped because it failed or because it was flaky.

```sh
PLAYWRIGHT_BASE_URL=https://rental-management-app-wine.vercel.app npx playwright test e2e/deploymentSmoke.spec.ts
```

---

## 9. Cross-check against the course requirements

| Requirement, from `docs/00-course-requirements.md` section 5 | Where it is covered |
| --- | --- |
| Core features | Section 1, CORE-01 to CORE-27 |
| Invalid inputs | Section 2, INV-01 to INV-52, every field of every form |
| Central business processes | Section 3, PROC-01 to PROC-18: lease lifecycle, rent lifecycle with a month going overdue, maintenance lifecycle |
| Permission differences between user types | Section 4, PERM-01 to PERM-35 |
| Database | Section 5, DB-01 to DB-22: constraints, the overlap guarantee, cascades |
| Edge cases | Section 6, EDGE-01 to EDGE-18 |
| Basic UI | Section 7, UI-01 to UI-11 |
| Documented manual tests where automation is not appropriate | Section 8, MAN-01 to MAN-05, each with a reason |

## 10. What is deliberately not tested, and why

Stated so that the gaps are choices rather than oversights.

| Not tested | Why |
| --- | --- |
| Supabase Auth itself | Testing that a hosted service hashes passwords correctly tests the vendor, not this product |
| Next.js routing internals | Same reasoning. The routing rules in `redirectDestination.ts` are tested; the framework's implementation of them is not |
| Every shadcn component | They are vendored and covered by their own project. Two are edited and only for appearance: `table.tsx` for its padding and header type, `input.tsx` so a text field matches the select and the textarea beside it |
| Styling values | Whether a border is one pixel or two is not something a test should have an opinion about; MAN-02 covers whether it looks right |
| Load and concurrency at scale | Out of scope for the deliverable, and discussed instead in the scale document. DB-01 covers the one concurrency guarantee that matters for correctness |

