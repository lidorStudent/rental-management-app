# Decisions Log

A running record of every technical decision in this project that is worth defending out loud.
Appended to at the end of every phase.

Each entry states what was decided, what the alternatives were, and why this one was chosen, in
three or four lines. The purpose is to make the project explainable under interview-style
questioning: if a choice cannot be justified here, it should not be in the codebase.

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
