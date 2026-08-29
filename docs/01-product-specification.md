# Product Specification

Rental management app for small landlords, with a tenant portal.

Document status: baseline for all later phases. Business and product level only. Technical design
lives in the technical planning document.

## 1. What the product is

A single place where a landlord who owns a handful of rental units keeps the facts about those
units: who lives in them, under what lease, what rent has been received, and what is broken. Tenants
get a read-only portal onto their own lease and their own payment history, plus one place to report
a problem.

The product is a record system, not a transaction system. It does not move money. It records money
the landlord says arrived, and derives everything else from that record.

## 2. The problem

### 2.1 Who has it

A landlord with between one and roughly twenty units. This is not their full-time job. They manage
the portfolio out of a spreadsheet, a bank app, a phone camera roll full of lease photographs, and
several WhatsApp threads. Commercial property management software is priced and designed for
operators with hundreds of units and an office staff, so this landlord never adopts it and stays on
the spreadsheet.

The spreadsheet does not fail loudly. It fails by going quietly out of date, and every failure below
is a symptom of the same root cause: the facts live in several places and nothing reconciles them.

### 2.2 The four concrete failures

| Failure | How it happens today | What it costs |
| --- | --- | --- |
| Leases expire unnoticed | The end date exists only inside the signed PDF and the landlord's memory. Nothing surfaces it. The landlord notices when the tenant mentions moving out, or does not notice at all. | Either an unplanned vacancy with no replacement tenant lined up, or a tenant occupying a unit with no lease in force. One vacant month on a twelve-month lease is roughly eight percent of that unit's annual revenue. The legal exposure of an expired lease is worse than the vacancy. |
| Rent goes overdue before anyone flags it | The landlord checks the bank account when they happen to think of it. A missing transfer looks identical to a transfer they have not looked for yet. | Late rent is discovered weeks late instead of days late. Recovery gets harder the longer it runs, and the conversation that would have been a reminder becomes a confrontation. Partial payments are the worst case: they are almost never tracked at all, so a tenant who paid half is filed mentally as "paid". |
| Maintenance is lost in chat threads | A tenant reports a leak in WhatsApp. It scrolls away under other messages. There is no status, no owner, and no list. | Small repairs become large repairs. The tenant repeats themselves, loses confidence, and escalates. Neither side can say what was reported when, which makes any later dispute unresolvable. |
| No single view of what is owed | Outstanding rent is spread across a spreadsheet, a bank statement, and memory, per unit, per month. | The landlord cannot answer "how much am I owed right now" without half an hour of manual work, so they stop asking. Decisions about the portfolio get made on a feeling rather than a number. |

### 2.3 The shape of the solution

Every one of those failures is a visibility failure, not an effort failure. The landlord is willing
to act; they are not being told there is something to act on. The product's job is to hold the facts
in one place and put the ones that need attention in front of the landlord when they open it.

## 3. The users

Two user types. There is no administrator role, no staff role, no contractor role, and no accountant
role. Adding a third user type multiplies the permission surface, and nothing in the four failures
above requires one.

### 3.1 The landlord (also: the small property manager)

Owns or manages the units. Holds all the money and all the authority in the product.

**Goals**

- Know, without doing arithmetic, what is owed across the whole portfolio right now.
- Never be surprised by a lease ending.
- Record a payment in seconds, at the moment it arrives, from wherever they are.
- Have a defensible record of what was paid and what was reported, if a tenant disputes it.
- Stop being the human router for status questions.

**A normal day**

They are at their actual job. At lunch they open the bank app, see two transfers landed overnight,
and want to write them down before they forget which unit each belongs to. In the afternoon a tenant
messages about a boiler. In the evening they remember, vaguely, that one of the leases ends
"sometime around spring" and cannot recall which. Their entire interaction with the portfolio is a
handful of two-minute windows spread across the day, from a phone, interrupted. Any workflow that
requires a sitting-down session will not get done.

### 3.2 The tenant

Rents one unit under one lease. Sees only their own lease and their own payment history.

**Goals**

- Confirm that the rent they sent was received and recorded, without messaging anyone.
- See what they owe, what they have paid, and what remains.
- Look up their own lease terms without hunting for a PDF.
- Report a problem to somewhere that will not lose it, and see that it was seen.

**A normal day**

They do not think about the app at all. They open it three or four times a year: after paying rent,
when something breaks, when they want to check their end date, and when someone asks them for proof
of tenancy. This is the defining constraint on the tenant portal. It must be immediately
understandable to someone who has not opened it in four months and has forgotten it exists. It gets
no onboarding, no training, and no second chance.

### 3.3 What each user needs at a glance

| | Landlord | Tenant |
| --- | --- | --- |
| First thing they need to see | What needs attention: overdue rent, leases ending soon, open maintenance requests | Their own rent status for the current period |
| Frequency of use | Several short visits per week | A few visits per year |
| Data they can reach | Everything they own | Their own lease and its payments and requests, nothing else |
| Data they can change | Properties, units, leases, payments, maintenance status | Nothing, except submitting a maintenance request |
| Tolerance for complexity | Moderate, this is their asset | None |

## 4. The customer

The customer is the landlord. The landlord pays. The tenant is a user and never a buyer.

This distinction drives real product decisions, so it is stated explicitly rather than assumed.

| Dimension | Landlord | Tenant |
| --- | --- | --- |
| Relationship to the product | Buys it, chooses it, can abandon it | Is invited into it, did not choose it |
| What makes it worth using | Money recovered and hours saved | Not having to send a message to get an answer |
| Cost of losing them | The account ends | The landlord ends up answering questions manually again |
| Consequence for design | The landlord's workflow sets the product's priorities | The tenant's experience must be effortless, because friction there converts directly into landlord support work |

The tenant portal is therefore not a lesser feature. It is the mechanism by which the landlord stops
being a message router. But when the two users' interests compete, the landlord's workflow wins,
because the landlord is the one who decides whether the product continues to exist.

## 5. Business goals

Each goal is stated so that it can be measured. "Today" describes the spreadsheet baseline.

| # | Business goal | Measure | Today | Target |
| --- | --- | --- | --- | --- |
| G1 | No lease expires without the landlord knowing in advance | Share of leases whose end date passes without the landlord having seen it surfaced beforehand | Unmeasured, and in practice frequent | Zero. Every lease ending within the next sixty days is visible on the landlord's first screen |
| G2 | Overdue rent is noticed in days, not weeks | Elapsed days between a rent period becoming overdue and the landlord being aware of it | Whenever the landlord next reconciles the bank statement, typically weeks | Same day the landlord next opens the product, with no reconciliation step |
| G3 | Maintenance requests are tracked from report to resolution | Share of requests that have a recorded submission date, a current status, and a resolution date | Effectively zero, requests live in chat | One hundred percent of requests submitted through the portal |
| G4 | The landlord can state what is owed across the portfolio immediately | Time to produce total outstanding rent across all units | Twenty to thirty minutes of manual work, so it is rarely done | Under ten seconds, with no manual calculation |
| G5 | Tenants answer their own status questions | Number of tenant messages asking whether rent was received or what is owed | Every payment cycle, per tenant | Reduced to exceptions only. The answer is in the portal and is current |
| G6 | A rent statement can be produced on demand | Time to produce a per-lease statement of charges and payments for a date range | Manual assembly from spreadsheet and bank records, thirty minutes or more | Under one minute, generated from the ledger |
| G7 | The payment record is defensible in a dispute | Share of recorded payments carrying date, amount, method, and who recorded them | Partial at best, often a bank line with no context | One hundred percent. Every payment is attributable and dated |

## 6. Capabilities required, and the goals they serve

A capability earns its place only by serving a stated business goal. Anything that maps to no goal
is out of scope by definition.

| # | Capability | What it must do | Serves |
| --- | --- | --- | --- |
| C1 | Accounts and roles | Let a landlord register and sign in. Let an invited tenant sign in. Establish which of the two roles the signed-in person holds, since every other capability depends on it | All |
| C2 | Property and unit registry | Record properties and the units inside them, so that every lease, payment, and maintenance request attaches to a specific unit | G1, G3, G4 |
| C3 | Lease lifecycle | Record who rents which unit, at what rent, from when to when, and prevent a unit from being under two active leases at once | G1, G7 |
| C4 | Rent schedule | Turn a lease into the sequence of rent periods it implies, so that "what is owed" exists as data rather than as a calculation someone has to remember to perform | G2, G4, G6 |
| C5 | Payment ledger | Let the landlord record a payment received against a rent period, with date, amount, method, and an optional reference | G4, G6, G7 |
| C6 | Derived rent status | Compute each period's status from the ledger and the current date. Due, partial, paid, or overdue. Never entered by hand | G2, G4, G5 |
| C7 | Attention dashboard | Show the landlord, on arrival, what needs action: overdue periods, leases ending soon, open maintenance requests | G1, G2, G3, G4 |
| C8 | Maintenance requests | Let a tenant submit a request against their unit, and let the landlord move it through a defined set of statuses to resolution | G3 |
| C9 | Tenant self-service views | Show a tenant their lease terms, their rent status, and their full payment history, and nothing belonging to anyone else | G5 |
| C10 | Rent statement | Produce a statement for one lease over a date range, listing charges, payments, and the closing balance | G6, G7 |
| C11 | Tenant onboarding | Let the landlord invite a tenant to a lease and have that tenant reach their own portal, with no manual account setup | G5 |

## 7. Central processes, end to end

Each process is described as the user experiences it. Preconditions, the path itself, the resulting
state, and what can go wrong.

### P1. Registration and login

| | |
| --- | --- |
| Actor | Landlord (self-service) or tenant (by invitation) |
| Trigger | A landlord decides to start using the product. A tenant receives an invitation for their lease |
| Precondition | None for the landlord. For the tenant, an invitation issued against an existing lease |

**Path.** A landlord registers with an email address and a password and lands on an empty dashboard
that tells them the first thing to do is add a property. A tenant does not register on their own.
They follow the invitation from their landlord, set a password, and land directly on their own
lease. On any later visit, either user signs in and arrives at the view for their role.

**End state.** The person is signed in and the system knows which role they hold and which data
belongs to them.

**What can go wrong.** Email already registered. Wrong password. An invitation that has already been
used, or has expired, or was issued for a lease that has since ended. A tenant who tries to register
directly rather than through an invitation. Each of these has to produce a clear message that does
not reveal whether a given email address exists in the system.

### P2. Adding a property and its units

| | |
| --- | --- |
| Actor | Landlord |
| Trigger | Setting up the portfolio, or acquiring a new property |
| Precondition | Signed in as a landlord |

**Path.** The landlord adds a property with its address. Inside it they add one or more units, each
with a label that they will recognise, such as a flat number. A single-dwelling house is a property
with one unit; the model does not special-case it, because a uniform structure is easier to reason
about than two parallel ones.

**End state.** Units exist and are available to hold leases.

**What can go wrong.** Two units with the same label in one property. A property with no units, which
is valid but useless and should be visible as incomplete. Deleting or archiving something that has
history attached to it: a unit that has ever had a lease cannot simply disappear, because payments
and maintenance history hang off it.

### P3. Creating a lease and onboarding a tenant

| | |
| --- | --- |
| Actor | Landlord |
| Trigger | A tenant has agreed to rent a unit |
| Precondition | The unit exists |

**Path.** The landlord selects the unit and records the lease: tenant name and email, start date, end
date, monthly rent, rent due day, and deposit if any. The system refuses the lease if the unit
already has an active lease overlapping those dates, and says which existing lease conflicts. On
acceptance, the rent schedule for the lease is generated. The landlord then invites the tenant, who
receives access to that lease and only that lease.

**End state.** An active lease exists, its rent periods exist, and the tenant can reach their own
portal.

**What can go wrong.** An end date before the start date. A rent due day that does not exist in every
month. An overlapping lease on the same unit, which must be rejected rather than merged or silently
allowed. A back-dated lease start, which is legitimate and must generate the periods that have
already passed. An invitation sent to an email address that already belongs to another account.

### P4. Recording rent received

| | |
| --- | --- |
| Actor | Landlord |
| Trigger | Money arrives, by transfer, cash, or cheque |
| Precondition | An active lease with a rent schedule |

**Path.** The landlord opens the lease, or the unit, and records a payment: amount, date received,
method, and an optional reference. It is applied to a rent period. The period's status changes on
its own: fully covered becomes paid, partially covered becomes partial, and anything past its due
date without full coverage becomes overdue. The landlord types no status anywhere. The portfolio
total and the tenant's own view both reflect the payment immediately.

**End state.** The payment is in the ledger, attributable and dated, and every derived figure is
current.

**What can go wrong.** An amount that is zero, negative, or larger than the outstanding balance. An
overpayment, which is real and must be handled rather than rejected outright. A payment dated in the
future. A payment recorded against the wrong period, which the landlord must be able to correct
without deleting history. Two part-payments against one period, which is the normal case and must
add up correctly.

### P5. Submitting and resolving a maintenance request

| | |
| --- | --- |
| Actors | Tenant submits, landlord resolves |
| Trigger | Something in the unit is broken |
| Precondition | An active lease |

**Path.** The tenant submits a request from their portal: a short title, a description, and an urgency.
It appears on the landlord's dashboard as open. The landlord moves it through its statuses as work
happens, and closes it as resolved with a resolution date. The tenant sees the current status on
their own portal at every stage, without asking.

**End state.** A request with a full history: reported when, by whom, against which unit, resolved
when.

**What can go wrong.** A submission with no description. A request against a lease that has ended. A
tenant attempting to change a status, which only the landlord may do. A request reopened after
resolution. A long backlog of open requests, which must remain readable rather than becoming a wall.

### P6. A tenant viewing their own lease and payment history

| | |
| --- | --- |
| Actor | Tenant |
| Trigger | Checking whether a payment landed, checking the end date, or proving tenancy |
| Precondition | Signed in as the tenant on an existing lease |

**Path.** The tenant opens the portal and immediately sees the current period and its status, the
amount outstanding if any, and their lease terms. Below that is the full payment history: every
payment the landlord recorded, with date, amount, and method. Nothing on the page belongs to another
tenant, another lease, or another unit.

**End state.** The tenant has their answer and has sent no messages to get it.

**What can go wrong.** A tenant with no active lease, for example after it ends, who must still be
able to see their own history. A tenant who has somehow been attached to more than one lease over
time, whose history must remain separated by lease. Any attempt to reach another lease by guessing
at an address must fail on the server, not merely be hidden in the interface.

### P7. Producing a rent statement

| | |
| --- | --- |
| Actor | Landlord, on their own behalf or at a tenant's request |
| Trigger | Year end, a dispute, a mortgage or benefits application, or a tenant asking for proof |
| Precondition | A lease with a rent schedule and a payment history |

**Path.** The landlord picks a lease and a date range. The system produces a statement listing every
rent period charged in that range and every payment recorded against it, in date order, with the
closing balance. The statement is generated from the ledger, so it cannot disagree with what either
user sees elsewhere.

**End state.** A statement that can be read on screen and handed to a third party.

**What can go wrong.** A date range with no activity, which must produce an explicit empty statement
rather than a blank page. A range that starts before the lease did. A range that includes future
periods not yet due. Rounding across many part-payments, where the closing balance must be exact.

### P8. Sharing lease and payment information with the tenant through the portal

| | |
| --- | --- |
| Actor | Landlord, indirectly |
| Trigger | Any change the landlord records |
| Precondition | The tenant has been onboarded to the lease |

This process is deliberately not a feature the landlord operates. There is no send button and no
share action. The tenant's portal reads the same records the landlord maintains, so recording a
payment is publishing it. This is the mechanism behind goal G5: the landlord's normal bookkeeping is
what keeps the tenant informed, with no second step to remember.

**End state.** The tenant always sees the current state of their own lease. The landlord never
prepares an update.

**What can go wrong.** The obvious risk of this design is that a mistake becomes visible instantly,
so corrections must be as easy as entries. The scope of what a tenant may see is fixed by the
product and is never widened by a landlord action, which removes any possibility of a landlord
accidentally exposing one tenant's data to another.

## 8. Product rules that must never break

These are business rules, not implementation details. They are listed here because a later phase
must be able to point at the requirement that justifies enforcing them.

1. A unit is never under two overlapping active leases. A conflicting lease is rejected at creation
   with the conflict named.
2. Rent status is always derived from the ledger and the current date. No user, including the
   landlord, can type a status.
3. A tenant can read and write only rows belonging to their own lease.
4. A landlord can read and write only rows they own.
5. Rent is a ledger of payments the landlord records as received. The product never holds, moves, or
   requests money.

## 9. Scope boundaries

What the product deliberately does not do, and why. Each exclusion is a decision, not an oversight.

| Not in the product | Why not | What we do instead |
| --- | --- | --- |
| **Processing payments** | Taking money means a payment provider, card data handling, refunds, chargebacks, failed-payment states, payout timing, and financial regulation. That is a larger and riskier product than the one being built, and it does not address the stated problem. The four failures in section 2 are failures of record keeping, not of money movement. Landlords already receive rent by bank transfer, cash, or cheque, and that works | The landlord records what they received. The ledger is the landlord's assertion of fact, and every derived figure follows from it. The tenant sees what was recorded and can challenge it against their own bank record |
| Automated reminders by email or SMS | Sending on someone's behalf brings deliverability, opt-out handling, timing rules, and tone decisions that vary by jurisdiction and by landlord. It also changes the product from a record system into a communication system | The dashboard surfaces what needs attention when the landlord opens it. The landlord decides how and whether to contact the tenant. This is a real limitation and is recorded as such: it means the product informs a landlord who opens it, not one who does not |
| General messaging between landlord and tenant | Chat is where the maintenance problem came from. Rebuilding it inside the product recreates the failure | Maintenance requests carry their own history and status. Everything else stays in whatever channel the two already use |
| Recommendations, predictions, and insights | Anything predictive here would be inference from a handful of tenancies. Twenty units over two years is not a sample a conclusion can be drawn from, and the failure mode is specific: a recommendation carries the authority of a system that knows something, so a landlord acts on it, when the arithmetic behind it was four data points and a coincidence. Suggesting what to charge, or which tenant to expect trouble from, also carries valuation and discrimination exposure that a record system has no business taking on | The attention dashboard (C7) shows what needs action, and every line of it is a fact the landlord entered: which months are unpaid, which tenancies end within sixty days, which repairs are still open. The product does the arithmetic and the landlord draws the conclusion, which is the right division of labour when the landlord is the one who knows the tenant |
| Accounting, tax reporting, and expense tracking | A different job for a different tool, with jurisdiction-specific rules the product cannot responsibly encode | Rent statements are produced from the ledger and can be handed to an accountant |
| Multiple staff accounts under one landlord | Adds delegated permissions, invitations, and role hierarchies to a product whose target user manages twenty units alone | One landlord account per portfolio. A property manager uses it exactly as a landlord does |
| Document storage and electronic signature | Storage of signed agreements is a compliance and retention question that deserves its own design | Lease terms are recorded as structured data. The signed document stays wherever the landlord keeps it today |
| Listings, applications, and tenant screening | This is the acquisition end of the funnel. The product starts once a tenant has agreed to rent | Leases are created for tenants the landlord already has |
| Utilities, meter readings, and variable service charges | Every one adds a second kind of charge, which doubles the ledger model before the first kind has proven itself | Rent only, as a single recurring charge per period |
| Multiple currencies | Every unit in a small portfolio is in one country | A single currency throughout |
| Native mobile applications | The landlord's usage pattern is short interruptions on a phone, which a responsive web application serves | Responsive web, usable one-handed on a phone |

## 10. Assumptions

Stated so that a later phase can challenge them rather than inherit them silently.

- One tenant account per lease. A shared flat is represented by one primary tenant on the lease.
- Rent recurs monthly. Weekly and quarterly rent exist in the market but are not supported.
- One landlord account owns a portfolio. There is no transfer of ownership between accounts.
- The landlord is the source of truth on whether money arrived. The product has no independent view
  of their bank account.
- All interface text and all documents are in English.

## 11. Definition of done for the first version

The first version is complete when both users can complete every process in section 7 end to end,
against real data, on a public URL, with the rules in section 8 enforced on the server, and with the
failure cases named under each process handled rather than merely avoided.
