# What the permission tests prove

A study note for the questions that follow "how do you know one landlord cannot see another's
data?" The honest answer is not "I checked in the browser". It is a suite of a hundred and thirty-five tests that
attack the database directly, with real credentials, and are refused.

Run them with `npm run test:db`.

---

## The claim, stated precisely

> No signed-in user can read or write a row that does not belong to them, by any route, including
> routes the application does not offer.

The second half is the part worth stressing. It is easy to prove that a page does not show
somebody else's lease. What matters is that there is no request anyone could make that would.

---

## Why testing the database directly is stronger evidence

Picture the layers between a request and a row:

```
the interface        hides a button
the routing          redirects a tenant away from /landlord
the server action    checks the acting user owns the parent row
Row Level Security   decides which rows exist for this session
```

A test at each level proves something different, and only one of them proves the claim.

| A test that... | Fails when | Passes when the claim is false? |
| --- | --- | --- |
| Clicks through the interface | A control is shown that should not be | **Yes.** Hiding a button changes nothing about what the server will answer |
| Visits a URL as the wrong role | The redirect is missing | **Yes.** A redirect is a suggestion to a browser; curl ignores it |
| Calls a server action with a forged id | The ownership check is missing | **Yes.** It proves this action is careful, not that the next one will be |
| **Queries the table directly, signed in as the wrong user** | The policy is missing or wrong | **No.** There is nothing underneath it to be careful for you |

The first three test **paths**. The last tests the **boundary**. A path can be added tomorrow; the
boundary is the same for every path that will ever exist.

Concretely, in `tests/landlordIsolation.test.ts`:

```ts
const { data } = await eitan.from("leases").select("id").eq("id", SEEDED_IDS.leaseMayaActive);
expect(data).toEqual([]);
```

That is Eitan's own session, his own key, naming Noa's tenancy by its exact identifier, with no
page, no action and no framework in the way. It is the strongest form the question can take, and the
answer is an empty array.

**The sentence to have ready:** if every line of application code were deleted tomorrow and the
database were left exposed to the internet with the public key, these tests would still pass.

---

## What is in the suite

A hundred and thirty-five tests in seven files, all against the **test** project, never production.

| File | Proves |
| --- | --- |
| `tests/landlordIsolation.test.ts` | One landlord cannot select, insert, update or delete anything of another's, across all six tables and all three aggregate views. Also that a landlord *can* do all four to their own, so the policies are not simply refusing everything |
| `tests/tenantIsolation.test.ts` | One tenant cannot reach another's tenancy, ledger, requests, unit, building or profile, even naming rows by identifier. Also that a tenant cannot write to `leases` or `rent_payments` at all, and that their one write reaches one column |
| `tests/anonymousAccess.test.ts` | The key that ships in every browser is worth nothing on its own: every table and every view answers a session-less client with `[]` |
| `tests/serverActions.test.ts` | The action layer refuses a mismatched role and a forged identifier, with a message that does not say whether the row exists, and stamps ownership from the session rather than from the payload |
| `tests/domainInvariants.test.ts` | One test per invariant from CLAUDE.md, so each can be pointed at directly |
| `tests/schemaGuarantees.test.ts` | What the schema refuses without any application code running: rent of nothing, a negative deposit, a tenancy ending before it starts, a rent day that does not exist in every month |
| `tests/passwordChange.test.ts` | Changing a password proves the old one, a tenant can replace the temporary password they were given, and a throttled attempt is told to wait rather than told the password is wrong |

### The positive control

A suite that only proves refusals could be passed by a database that refuses everything. So
`landlordIsolation.test.ts` also creates a property, reads it, renames it and deletes it as its
owner; records a payment, corrects it and removes it; and moves a maintenance request along. The
policies allow exactly what the product needs and nothing else, and both halves are tested.

### The guard

`tests/support/testDatabase.ts` reads `.env.test` and refuses to start if the project reference is
the production one:

```
REFUSING TO RUN: these tests are pointed at the production project jarkqjrfuzvvrbietxve.
They sign users in and write rows.
```

These tests write to the database. Pointed at the deployed project they would put test tenancies
into a real portfolio, so the check happens before a single client is built.

---

## The five invariants, and the test that catches each

| # | Invariant | The test that fails if it breaks |
| --- | --- | --- |
| 1 | A unit never has two overlapping active leases | An overlapping insert **with the service role**, bypassing every application check, must be refused with `23P01`. If this ever passes, the guarantee is not in the database |
| 2 | Rent status is derived, never typed in | Asking the database for a `status` column on `rent_payments` must fail with `42703`. It holds because there is nowhere to write one, and this is what would stop being true if somebody added a column |
| 3 | A tenant reads and writes only their own lease's rows | Maya naming Yonatan's tenancy by identifier gets `[]`; reporting a problem against his lease is refused `42501` |
| 4 | A landlord reads and writes only rows they own | Eitan naming Noa's tenancy gets `[]`; updating it changes nothing |
| 5 | Rent is a ledger the landlord records | A tenant inserting, updating or deleting a payment is refused, and every seeded payment carries the landlord as `recorded_by` |

Invariants 1 and 2 are not policies at all. One is an exclusion constraint and the other is the
absence of a column, and both are worth saying out loud because they show the difference between a
rule that is enforced and a rule that is merely followed.

---

## Two subtleties worth being able to explain

**Why a refused write sometimes returns an error and sometimes returns nothing.**

Row Level Security filters `UPDATE` and `DELETE` the way it filters `SELECT`: rows the policy does
not admit are not visible, so the statement matches nothing and succeeds having changed nothing.
`INSERT` is different, because there is no row to filter: the `WITH CHECK` either passes or raises
`42501`. So the suite asserts `[]` for updates and deletes, and an error code for inserts. Both mean
refused.

There is one place a tenant's update raises rather than returning nothing: changing the status of
their own resolved request. The row *is* admitted, by the policy that lets them confirm a fix, and
the trigger then refuses the column. That difference is itself the reason the trigger exists.

**Why a policy is not enough on its own.**

A policy decides which **rows** an operation may touch. It cannot decide which **columns**. A tenant
confirming a fix needs to update one column of a row they may otherwise not write at all, so the
policy admits the row and `maintenance_requests_tenant_confirms_only` compares every other column
and raises if anything else moved. The same shape guards `profiles.role`:
`profiles_update_own` legitimately lets a user update their own row, so a trigger is what stops
that user setting their own role to landlord. There is a test for each.

---

## Questions to expect

**Could a user just call the database directly and bypass your application?** Yes, and that is the
point: the key is in their browser already. These tests do exactly that, and get nothing.

**Why not test through the interface instead?** Interface tests prove the interface behaves. They
would keep passing if the policies were dropped, because the pages would go on hiding what they
always hid, right up until somebody opened a network tab.

**What does the service role prove?** Nothing about authorisation, which is why it appears only in
setup and cleanup, and in the one place it is the point: the overlap test uses it deliberately, to
show the constraint holds even when every application check is bypassed.

**How do you know the policies are not just blocking everything?** Because the same suite performs
every operation successfully as the rightful owner. A refusal is only evidence when the permission
is also demonstrated.
