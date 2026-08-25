# The rules, and why they are pure functions

A study note about the three rules that carry this product, and about one design decision that
shaped all of them. The decision is worth being able to defend on its own: **every rule is a
function of its arguments, and nothing else.** No database, no framework, no clock.

---

## What "pure" means here, and what it buys

A pure function is one where the same inputs always produce the same output, and calling it changes
nothing. Concretely, in `src/lib/leases/findConflictingLease.ts`,
`src/lib/rent/deriveRentStatus.ts` and `src/lib/maintenance/allowedStatusTransitions.ts`:

- no `supabase.from(...)`, so a test needs no database and no fixtures;
- no `new Date()` inside a rule, so "is this overdue?" can be asked about any day, not only today;
- no React, no Next, so a test needs no rendering and no request;
- nothing written anywhere, so tests can run in any order.

The payoff is the one that matters for this project: **the rules are the part that is worth testing,
and this is what makes them cheap to test.** A test for the rent status rule is three numbers, two
dates and an expected word. A test for the same logic embedded in a page would need a database with
a lease in it, a signed-in session, and a rendered component, and it would still be checking the
same three numbers.

The clock deserves its own sentence, because it is the usual mistake. If `deriveRentStatus` called
`new Date()` itself, the test "a period whose due date has passed reads as overdue" could only be
written by picking a date in the past and hoping, and the test "a period due tomorrow does not read
as overdue" would start failing tomorrow. Passing `currentDate` in makes both trivial, and the
production call site becomes the only place that reads the clock.

---

## Rule 1: two leases never share a unit

`src/lib/leases/findConflictingLease.ts`

**In plain language.** A unit is let to one tenant at a time. When a landlord records a lease, its
dates are compared with every other lease on that unit. If the two ranges touch at all, the new
lease is refused, and the landlord is told which lease is in the way.

Three things about it are worth saying out loud.

**Both endpoints are occupied.** A lease that ends on the 31st still owns the 31st. This matches
`daterange(start_date, end_date, '[]')` in the database exactly, and it has to: if the function were
more permissive than the constraint, the form would accept a lease that Postgres then rejects, and
the landlord would see a database error instead of a sentence.

**Every lease counts, whatever its dates.** There is no lease status in this product; a lease's
dates are its lifecycle. A tenancy that ended in 2020 still owns 2020, because recording a new lease
over a period already let would produce a ledger claiming two tenants owed rent for the same flat in
the same month.

**An edit excludes itself.** Editing a lease's end date compares it against every lease on the unit
except the version of itself already stored, through `leaseIdBeingEdited`. Without that, every edit
would collide with itself and no lease could ever be changed.

**This function is not the guarantee.** The exclusion constraint in the database is. Two landlords,
or one landlord with two browser tabs, can both read "no conflict" before either writes: that is a
race, and no amount of checking first fixes it. The constraint holds because Postgres serialises the
check with the write. This function exists so that the refusal comes with the dates of the lease
that caused it, and `createLease` also maps Postgres error `23P01` to the same message for the race
that slips through.

### The boundary case, worked through

Maya's lease on Flat 1 runs **2026-01-01 to 2026-05-31**. Noa wants to let the same flat to a new
tenant, and tries three start dates.

| Proposed lease | Overlap test | Result |
| --- | --- | --- |
| 2026-05-30 to 2027-05-29 | `"2026-05-30" <= "2026-05-31"` and `"2026-01-01" <= "2027-05-29"` | Refused. Two tenants would hold the flat on 30 and 31 May |
| **2026-05-31 to 2027-05-30** | `"2026-05-31" <= "2026-05-31"` and `"2026-01-01" <= "2027-05-30"` | **Refused.** This is the boundary case: Maya's tenancy includes 31 May, and she is paying rent for a month that includes it |
| 2026-06-01 to 2027-05-31 | `"2026-06-01" <= "2026-05-31"` is false | Allowed. The handover day belongs to the outgoing tenant, and the new tenancy starts the next morning |

The whole test is:

```ts
proposed.startDate <= existing.endDate && existing.startDate <= proposed.endDate
```

Each range starts on or before the other ends. Dates are `YYYY-MM-DD` strings, which sort in
chronological order as text, so `<=` is the comparison and nothing is parsed. No `Date` object
appears anywhere in the rule, which is also why no timezone can move a lease by a day.

---

## Rule 2: rent status is derived, never typed in

`src/lib/rent/deriveRentStatus.ts`

**In plain language.** Given what a period charges, what has been paid against it, when it fell due,
and what today is, the period is in exactly one of four states.

The order the four are decided in **is** the rule:

1. **paid**, when the payments cover the rent. An overpayment is still paid.
2. **overdue**, when the due date has passed and they do not.
3. **partial**, when something has been paid and the due date has not passed yet.
4. **due**, when nothing has been paid and the due date has not passed yet.

A part-paid period whose due date has gone reads as **overdue**, not partial. That is a product
decision, not an oversight: the landlord is looking for the list of things that need chasing, and a
tenant who paid half of last month's rent is on it. The amount still outstanding is shown next to
the status, so the part payment is not hidden.

`currentDate > dueDate` means a period is not overdue *on* its due day. Rent due on the tenth is due
on the tenth; it is late on the eleventh.

There is no status column anywhere in the database, which is what makes this rule structurally true
rather than merely intended. There is nowhere to write a status even if someone wanted to, so the
answer cannot drift away from the payments it claims to summarise.

---

## Rule 3: a maintenance request follows one route

`src/lib/maintenance/allowedStatusTransitions.ts`

**In plain language.** A request arrives as *submitted*. The landlord can acknowledge it, start work
on it, or resolve it outright. A resolved request can be reopened to *in progress*. It can never go
back to *submitted*, and it cannot be moved to the status it already has.

| From | May become |
| --- | --- |
| `submitted` | `acknowledged`, `in_progress`, `resolved` |
| `acknowledged` | `in_progress`, `resolved` |
| `in_progress` | `resolved` |
| `resolved` | `in_progress` |

Steps can be skipped forwards, because a landlord who fixes a tap within the hour should not have to
click through two intermediate states to say so. Nothing goes backwards to *submitted*, because a
request that has been seen cannot become unseen. Reopening exists because a problem that comes back
was never really finished.

The map is a single constant read by both sides: `MaintenanceStatusControl` renders exactly the
transitions it lists, and `updateMaintenanceRequestStatus` refuses anything it does not. That is
what stops the buttons and the rules drifting apart. `resolvedAtForStatus` carries the other half of
the rule, that "resolved" and "has a resolution date" are the same fact, which the database also
enforces with a check constraint.

---

## The schemas, and where each rule actually lives

`src/lib/validation/` holds one schema per input, imported by both the form and the server action.
One definition, run twice: on the client for fast feedback, on the server as the trust boundary.

The schemas encode real rules, not just types:

- an end date must be after a start date, and 2026-02-30 is not a date at all;
- rent and payments must be above zero, and a deposit may be zero but never negative;
- a rent due day is between 1 and 28, so every month has one;
- a maintenance description of "broken" is refused, because it gives the landlord nothing to act on;
- email addresses are trimmed and lowercased, so one tenant cannot end up with two accounts.

Money never touches floating point. `parseCurrencyInputToCents` reads the digits as text and
assembles an integer, because `6500.10 * 100` is 650009.9999999999 in JavaScript and a ledger that
is out by an agora is a ledger nobody trusts.

One schema is a function rather than a value: `buildRecordRentPaymentSchema(currentDate)`. The rule
"a payment cannot have been received in the future" needs to know what today is, and the rest of
this codebase does not read the clock inside a rule. Passing the date in keeps that promise, and the
schema stays as testable as everything else here.

Three questions the schemas deliberately do **not** answer, because they depend on other rows:

| Question | Where it is answered |
| --- | --- |
| Does this lease collide with another on the unit? | `findConflictingLease`, then the exclusion constraint |
| Is this unit label already used in this property? | The `units_label_unique_per_property` constraint |
| Does this payment's month fall inside its lease? | The server action, which has the lease |

That division is the point: a pure function can only judge what it was given.

---

## Questions to be ready for

**Why not check the overlap only in the database?** Because the constraint can only refuse; it
cannot say which lease is in the way. The function produces the sentence, and the constraint
produces the guarantee.

**Why is a lease that ended years ago still checked?** Because a lease has no status here; its dates
are its lifecycle. The past is still let, and the ledger for that period already exists.

**Why does the current date come in as an argument?** So the rule can be asked about any day, and so
tomorrow's test run gives the same answer as today's.

**Why strings for dates?** A rent due date is a calendar fact, not an instant. `YYYY-MM-DD` sorts
chronologically as text, so comparisons need no parsing, and no timezone can move a date by a day.

**Where would you put a rule that needs the database?** In the server action, which has both the
data and the acting user. The moment a rule needs to look at other rows, it stops being a rule about
its arguments.
