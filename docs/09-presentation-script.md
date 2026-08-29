# Presentation script

Fifteen slides, about fourteen and a half minutes including a three-minute demo, which fits a ten to
fifteen minute slot with room to be interrupted. The deck itself is
[docs/presentation.pdf](presentation.pdf), built from this script.

**Before you start**

- Two browser windows, both at https://rental-management-app-wine.vercel.app, one signed out.
- Signed in as `noa.bendavid@example.co.il` in the first, password `Demo-Rental-2026!`.
- The second window signed out and ready for `maya.levi@example.co.il`.
- Zoom the browser to 125 per cent so the back row can read a table.
- If the network fails: the demo section below says what each step proves, so describe it and move
  on. Do not debug in front of the room.

**Timing at a glance**

| # | Slide | Time | Running |
| --- | --- | --- | --- |
| 1 | Title | 0:15 | 0:15 |
| 2 | What it is | 0:45 | 1:00 |
| 3 | The problem | 0:50 | 1:50 |
| 4 | The users | 0:40 | 2:30 |
| 5 | The business value | 0:45 | 3:15 |
| 6 | How it is built | 1:00 | 4:15 |
| 7 | The architecture | 1:15 | 5:30 |
| 8 | The database | 1:15 | 6:45 |
| 9 | The central flows | 1:00 | 7:45 |
| 10 | Demo | 3:00 | 10:45 |
| 11 | The tests | 1:00 | 11:45 |
| 12 | Scale | 0:50 | 12:35 |
| 13 | Security | 0:50 | 13:25 |
| 14 | What I would improve | 0:45 | 14:10 |
| 15 | Close | 0:20 | 14:30 |

---

## Slide 1 - Title (0:15)

**On screen:** Rental Management. A rental system for small landlords, with a tenant portal. Your
name, the date, the deployed address.

**Say:** "This is a rental management system for landlords with a handful of flats, and a portal for
their tenants. It is deployed and I will demonstrate it on the live address."

---

## Slide 2 - What it is (0:45)

**On screen:** Four lines: Buildings and units. Tenancies. A rent ledger. Repairs, reported by the
tenant.

**Say:** "A landlord records their buildings, the units inside them, and who rents which unit for how
long at what rent. They write down rent as it arrives. The system works out what is paid, part paid,
due or overdue - the landlord never types a status. Tenants sign in and see their own tenancy, their
own payments and the problems they have reported. One sentence that matters for scope: this records
money that arrived, it does not move money. There is no payment processing here and that is
deliberate."

---

## Slide 3 - The problem (0:50)

**On screen:** A spreadsheet, a phone, and a memory. Three failures: what is owed is a calculation
somebody does by hand; the tenant has to ask; nothing is written down when a repair is promised.

**Say:** "Small landlords do not have property managers. They have a spreadsheet, a phone and their
memory. Three things go wrong. First, 'how much am I owed right now' is arithmetic somebody has to
do, over a spreadsheet, and it is wrong as soon as the month turns. Second, the tenant has no way to
check anything without asking, so every question is a phone call. Third, a repair reported by phone
leaves no record, so nobody can say when it was reported or what was promised. The product exists to
answer those three, and nothing else - I deliberately kept the scope small enough to finish
properly."

---

## Slide 4 - The users (0:40)

**On screen:** Two roles. Landlord: owns everything, records everything. Tenant: reads their own
tenancy, reports problems, confirms repairs.

**Say:** "Exactly two roles, and the asymmetry between them is the whole design. The landlord owns
and records. The tenant reads their own tenancy and has precisely two writes anywhere in the system:
report a problem, and confirm that a repair was actually done. A tenant cannot mark their own rent as
paid - only the landlord records money, because only the landlord received it."

---

## Slide 5 - The business value (0:45)

**On screen:** Three lines: Arrears visible without arithmetic. Fewer phone calls. A record of what
was promised.

**Say:** "The value is in those three failures reversed. Arrears are visible at a glance and are
always current, because they are computed from the ledger and today's date every time you look. The
tenant portal removes the routine phone calls, because the tenant can see what the landlord sees
about their own tenancy. And every repair has a timestamped route from reported to resolved, with the
tenant's own confirmation at the end, so 'you never told me' stops being an argument."

---

## Slide 6 - How it is built (1:00)

**On screen:** Next.js App Router, TypeScript. Supabase: Postgres, Auth, Row Level Security. Vercel.
Tested with Vitest and Playwright.

**Say:** "Next.js with the App Router in TypeScript, deployed on Vercel. The database is Postgres
through Supabase, which also provides authentication. The single most important choice on this slide
is that authorisation lives in the database as Row Level Security, not in the application code. I
will come back to why. Everything that reads or writes runs on the server: server components fetch
data and send HTML, server actions take the writes. There is no database client in the browser at
all. Deliberately absent: no state management library, no data fetching library, no ORM, no PDF
library, no email service. Each of those is something I would have to justify, and each has a plainer
answer in this project."

---

## Slide 7 - The architecture (1:15)

**On screen:** The architecture diagram.

**Say:** "Follow one request. The browser sends a cookie holding the session. The proxy runs first on
every request: it verifies the token with Supabase Auth, refreshes it if it has expired, reads the
role from the database, and routes - no session goes to the login page, a tenant asking for a
landlord page is sent back to their own. Then either a server component reads, or a server action
writes, both through one client that carries the user's session. Every query reaches Postgres as that
user, and Row Level Security decides which rows exist for them. The important point is the direction
of trust: the routing at the top is a convenience so that people do not see pages they cannot use. If
you deleted it tomorrow, a tenant asking for another landlord's ledger would still get nothing,
because the database is what refuses."

---

## Slide 8 - The database (1:15)

**On screen:** The entity relationship diagram.

**Say:** "Six tables. Profiles is the application's view of an account - the primary key is the
authentication user id, so the policies can compare directly against it. Properties, then units,
because the unit is what is actually let; a house is just a property with one unit. Leases join a
unit to a tenant for a period, at a rent. Payments hang off the lease, and maintenance requests hang
off the lease too, because the tenancy is what makes both the landlord and the tenant able to see
them. Two things are not there and their absence is the design. There is no status column on a lease
and no occupied flag on a unit - those are computed from dates, so they cannot drift. And there is no
rent periods table - the schedule is derived from the lease, so ending a tenancy early cannot leave
stale rows behind. What is in the schema is the guarantee: an exclusion constraint that makes it
impossible for one unit to have two overlapping tenancies, under concurrency, whatever the
application does."

---

## Slide 9 - The central flows (1:00)

**On screen:** Every action, seven steps: resolve the user, refuse the wrong role, parse, apply the
rules, write, revalidate, return.

**Say:** "Every write in the system is a server action, and all twenty follow the same seven steps in
the same order. Resolve who is acting from the session. Refuse anyone who is not the right role.
Parse the input with a Zod schema - the same schema the form used, because the form's run is only
convenience and this run is the trust boundary. Apply the business rules that need other rows.
Write, with Row Level Security as the last word. Revalidate the pages whose output changed. Return a
typed result the form can put back next to the right field. No action ever takes an owner identifier
from its input: the landlord id comes from the session, so a client cannot claim to be somebody else
by typing an id into a form."

---

## Slide 10 - Demo (3:00)

**On screen:** Demo. Live at rental-management-app-wine.vercel.app.

Follow the click list below exactly. Speaking notes are inside it.

---

## Slide 11 - The tests (1:00)

**On screen:** 354 unit and component. 135 permission and database. 25 end to end. Plus five
documented manual checks.

**Say:** "Three suites. Three hundred and forty-six unit and component tests cover the rules at
their boundaries - the day a tenancy ends is still occupied, a part payment is partial and not
overdue until its due day passes. Twenty-two Playwright tests drive the whole processes in a real
browser. The interesting one is the middle: a hundred and thirty-four tests that attack the database
directly. They
do not use the interface, and that is the point - a test that drives the interface only proves the
interface offered no way in, and an attacker will not use the interface. They sign in as one landlord
with a real password and ask the database for the other landlord's rows, by id, by filter, through
the views, with updates and deletes as well as reads. There is also a positive control, the same
landlord doing all of it to their own rows, because a policy that refused everything would otherwise
pass."

---

## Slide 12 - Scale (0:50)

**On screen:** Measured, not assumed. Tens of users: fine. Hundreds: two specific problems, both
priced. One now fixed.

**Say:** "I did not want to guess at this, so I measured it: synthetic portfolios in the test
project, real queries, timed as a signed-in user. At tens of landlords everything answers in about a
tenth of a second. At hundreds, two things broke and I could name them. The first I have since
fixed. The deployed functions were running in Washington while the database is in Frankfurt, so
every round trip crossed the Atlantic; moving them to Frankfurt took the health check from six
hundred and forty-seven milliseconds to three hundred and thirty-eight, and cut the median page's
server time by two thirds. The second is still there: a small landlord's dashboard query went from
ninety-eight milliseconds to three hundred and fourteen purely because another landlord's rows
existed in the table, because the row-level security predicate on the payments table cannot be
answered from an index unless the query supplies its own filter. Both are written up with the
numbers in the scale document."

---

## Slide 13 - Security (0:50)

**On screen:** Session in an HTTP-only cookie. Authorisation in the database, 29 policies. Validation
on the server, always. What remains: no rate limiting, no MFA, no audit log.

**Say:** "The session is one HTTP-only cookie, which meant overriding a library default - Supabase's
helper leaves the cookie readable so its browser client can hydrate from it, and this project has no
browser client, so it was paying a cost for a feature it never used. Authorisation is twenty-nine
policies in the database. Validation runs on the server every time, whatever the form did. The
service role key, which bypasses everything, has one caller in the whole codebase and cannot be
imported into client code. And the honest part: there is no rate limiting on my own endpoints, no
multi-factor authentication, no audit log, and the session is still a bearer token, so an injected
script could act as the user even though it cannot read the cookie. Those are in the security
document rather than left to be discovered."

---

## Slide 14 - What I would improve with more time (0:45)

**On screen:** Done: the functions moved to Frankfurt. Next: give the aggregate queries an indexable
filter. Then: organisations, an audit log, rate limiting.

**Say:** "In priority order, and the order is by measured effect over risk. The first one is done:
moving the deployed functions into the same region as the database was one line, and it was the
largest measured cost in the system - two thirds off the median page. It also taught me something I
did not expect. The next item on my list had been to cut the four fixed round trips every request
makes; once the function sat beside the database, one round trip stopped being measurable at all, so
that item is worth nothing now and I withdrew it. Fix the latency before you count the round trips.
What is still worth doing is giving two queries an explicit filter so the database can use an index,
measured at five hundred and fifty-five milliseconds down to eighty-seven. After that, product
rather than performance: more than one person on a portfolio, which today means rewriting every
policy, an audit log, and rate limiting on my own endpoints."

---

## Slide 15 - Close (0:20)

**On screen:** The deployed address, the repository, and the documents.

**Say:** "It is deployed, it is tested at three levels, and every decision I made is written down
with its alternative in a decisions log. Happy to take questions."

---

## The demo, click by click

Three minutes. Two of these steps are deliberate failures, and they are the most valuable part of the
demo, so do not rush them.

### A. The landlord's view (0:45)

1. Show the window already signed in as **Noa Ben-David**, on `/landlord`.
   **Say:** "This is the dashboard. Four figures, and every one of them is a database aggregate, not
   a number added up in JavaScript. Rent collected this month, outstanding across the portfolio, open
   problems, occupancy - two of five units let."
2. Click **Properties** in the navigation, then **Rothschild 12**.
   **Say:** "Three units. Occupancy is derived from the tenancies, so nothing here can say let when
   the tenancy ended yesterday."
3. Click **Leases**, then the lease on **Flat 1**.
   **Say:** "One tenancy. The schedule below is generated from the lease's dates and its due day -
   there is no periods table - and each month carries a status derived from what has arrived against
   it. Two months here are overdue, which is why the dashboard said thirteen thousand outstanding."

### B. Recording a payment (0:35)

4. On the lease page, click **Record a payment**.
   **Say:** "The month list only offers months this tenancy actually ran for, and it shows what is
   still outstanding on each."
5. Point at the form without submitting.
   **Say:** "If I record a payment here, nothing writes a status anywhere. The next render asks the
   same function again with a different total, and the badge changes. That is the difference between
   derived and stored, and it is the reason the numbers cannot drift."

*(If time is short, describe step 5 rather than opening the form.)*

### C. Deliberate failure one: the overlapping tenancy (0:50)

6. Click **Leases**, then **Record a tenancy**.
7. Choose the unit **Flat 1 - Rothschild 12**, which is the flat you just looked at.
8. Set the start date to **2026-12-31** and the end date to **2027-06-30**. Fill the rent with
   **6500** and leave the due day at 10.
9. Click **Record tenancy**.
   **Expected:** the form refuses, with a message naming the conflict: this unit is already let from
   2025-12-01 to 2026-12-31, so a new tenancy can start on 2027-01-01 at the earliest. The same
   explanation appears against the start date and the end date fields.
   **Say:** "The thirty-first of December is the last day of the existing tenancy, and both endpoints
   belong to it, so this overlaps by exactly one day and the system says so - and it tells me the
   first date that would work. Two things refused this. The application checked, so that I could give
   that message. And underneath, a Postgres exclusion constraint would refuse the insert anyway, which
   is what makes it true when two requests race. I can show that with a test rather than a race."
10. Change the start date to **2027-01-01** and stop.
    **Say:** "With the first of January this is accepted. I am not going to submit it, because this is
    live demo data."

### D. Deliberate failure two: one tenant reaching for another's data (0:50)

11. Still as the landlord, click **Maintenance** and open a request reported by **Yonatan Azoulay**.
    Copy the identifier at the end of the address bar.
    **Say:** "This is a problem another tenant reported. I am taking its id."
12. Switch to the second window. Sign in as **maya.levi@example.co.il** with the same password.
    **Say:** "Maya is a different tenant, in a different flat, under the same landlord."
13. Show her portal briefly: her flat, this month's rent, what is outstanding.
    **Say:** "Notice there is no identifier anywhere in these URLs. The portal resolves her tenancy
    from her session, so there is nothing in the address bar to change."
14. In the address bar, go to `/tenant/maintenance/` followed by the identifier you copied.
    **Expected:** "Not found. That page does not exist, or it is not yours to view."
15. **Say:** "That is not the interface hiding a link. The query ran, and Row Level Security returned
    no rows, so the page cannot tell the difference between a record that belongs to someone else and
    one that never existed - and neither can she. It says the same sentence for both on purpose,
    because a different message would confirm the record exists."
16. Type `/landlord/rent` into the same address bar.
    **Expected:** she lands back on `/tenant`.
    **Say:** "And the areas are separated by role on the server, not by hiding the menu."

### E. Back to the deck (0:00)

Return to the presentation and continue at slide 11.

---

## If you are running short

Cut in this order, which loses the least:

1. Slide 3 down to one sentence, and slide 5 down to one line. Saves about a minute.
2. Demo step B entirely, describing it in a sentence from the lease page. Saves 35 seconds.
3. Slide 14's second half, the product improvements. Saves 20 seconds.

Never cut the two deliberate failures. They are the only part of the demo that proves anything a
screenshot could not.

## If you are asked a question you did not prepare

The twenty likeliest questions with answers are in
[docs/08-study-guide.md](08-study-guide.md), part 7. The three that come up most: why the
authorisation tests attack the database rather than the interface, why rent status is not stored, and
what stops two tenancies overlapping.
