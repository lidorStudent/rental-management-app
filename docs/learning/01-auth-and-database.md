# How a request proves who it is

A study note. The question behind it is the one an interviewer actually asks: *when a tenant opens
their portal, what stops them seeing another tenant's rent?* The answer is a chain, and the last
link is the only one that matters.

---

## The one-sentence answer

The browser sends a cookie, the server exchanges that cookie for a verified user id, every database
query is then made **as that user**, and Postgres itself decides which rows exist for them.

---

## The journey of one request

A tenant opens `/tenant`.

### 1. The browser sends a cookie

Supabase Auth issued two tokens when the tenant signed in: a short-lived **access token**, which is
a signed JWT containing their user id, and a longer-lived **refresh token**. `@supabase/ssr` stores
both in one cookie, and the browser attaches it to every request to our domain.

That cookie is HTTP-only because this project makes it so, in
`src/lib/supabase/sessionCookieOptions.ts`. The library leaves it readable by page JavaScript on
purpose, so that its browser client can hydrate the session from `document.cookie`; this project
never uses that client, reads the session only on the server, and so takes the flag back. Without
it, one line of injected JavaScript could take the refresh token and keep using it.

### 2. The proxy refreshes the session and decides where the request may go

`src/proxy.ts` runs before anything renders, using the client built in
`src/lib/supabase/middlewareClient.ts`. Next.js 16 renamed this file convention from `middleware`
to `proxy`; it is the same layer, and everyone still calls it middleware out loud.

It calls `supabaseClient.auth.getUser()`. That is a network call to the Auth service, which verifies
the token's signature and expiry and returns the user. The lazy alternative, `getSession()`, only
decodes the cookie and believes what it says. **Never route on `getSession()`.**

If the access token has expired, the client uses the refresh token to get a new one, and middleware
writes the rotated cookie onto the response. That write is why middleware exists at all: a server
component is not allowed to set cookies, which is why `src/lib/supabase/serverClient.ts` wraps its
`setAll` in an empty `catch`.

The proxy then asks `src/lib/authentication/redirectDestination.ts` where this request belongs. A
tenant asking for `/landlord` is sent to `/tenant`; a signed-out visitor is sent to `/login`; a
tenant who still has a landlord-issued temporary password is sent to `/change-password` and cannot
leave it.

**The role comes from the `profiles` table, not from the token.** A signed-in user can rewrite their
own token metadata through the Auth API. They cannot rewrite their profile row, because the
`profiles_role_is_immutable` trigger refuses it and because `profiles_update_own` only ever lets
them touch their own row.

### 3. The page or the action establishes the acting user

`src/app/tenant/layout.tsx` calls `requireTenantProfile()`, which calls
`src/lib/authentication/getSignedInProfile.ts`. That file is the only place in the codebase where
the question "who is acting?" is answered. It verifies the user with `getUser()`, reads their
profile row, and throws if either is missing.

Every server action starts the same way. No action reads a user id out of its own arguments, because
an argument is whatever the client typed.

### 4. The query is made as that user

`createSupabaseServerClient()` builds a client holding the tenant's access token. When it runs

```ts
await supabaseClient.from("rent_payments").select("*");
```

the token travels to PostgREST in an `Authorization` header. PostgREST connects to Postgres as the
`authenticated` role and puts the token's claims into the session, which is what makes
`auth.uid()` return this tenant's id inside the transaction.

Notice what was **not** sent: no tenant id, no lease id, no "where landlord_id = ...". The query says
"all rent payments". The filter is added by the database.

### 5. The policy decides which rows exist

From `supabase/migrations/20260825122721_row_level_security.sql`:

```sql
create policy rent_payments_select_as_tenant
on public.rent_payments for select to authenticated
using (public.is_current_tenant_lease(lease_id));
```

Postgres rewrites the query, appending that predicate. `is_current_tenant_lease` resolves the lease
from `auth.uid()`. Another tenant's payments are not hidden from the result: as far as this
transaction is concerned, **they do not exist**.

---

## Why the database is the real boundary

Four layers stand between a tenant and another tenant's data. Only one of them is load-bearing.

| Layer | Where | What happens if it is deleted |
| --- | --- | --- |
| Hiding controls in the interface | Components | Nothing. The user opens the URL directly and gets in |
| Proxy routing | `src/proxy.ts` | The wrong page renders, and its queries still return nothing |
| Ownership checks in the action | `src/actions/*.ts` | Errors get worse, and the write is still refused |
| **Row Level Security** | `supabase/migrations/…_row_level_security.sql` | **Every user can read and write every row** |

That table is the whole argument. The first three layers produce a good experience and good error
messages. The fourth is the one that would let data leak if it were wrong.

The practical consequence is a rule to state out loud: **authorisation is not a code path.** A code
path can be forgotten. Someone adds a new page, writes a new query, forgets the `.eq("landlord_id",
…)` filter, and it works perfectly in testing because they were signed in as the owner. With the
filter in the database, forgetting it returns their own rows anyway.

The single exception in this codebase is `src/lib/supabase/adminClient.ts`, which uses the service
role key and bypasses RLS entirely. It exists for one job, creating a tenant's account, and it has
one caller, `src/actions/tenantAccountActions.ts`, which checks that the acting landlord owns the
lease before it goes near it. The file starts with `import "server-only"`, so pulling it into a
client component is a build error, and the key it reads has no `NEXT_PUBLIC_` prefix, so it is never
sent to a browser.

---

## The whiteboard version

```
Browser                  Next.js server                     Postgres
   |                           |                                |
   |-- cookie (JWT) ---------->|                                |
   |                        src/proxy.ts                         |
   |                      auth.getUser()  --- verify --->  Auth service
   |                      profiles.role                         |
   |                      allowed here? ------------------------|
   |                           |                                |
   |                    server component / action               |
   |                    getSignedInProfile()                    |
   |                           |                                |
   |                    select * from rent_payments             |
   |                    (token attached)  -------------------> RLS
   |                           |                      using (is_current_tenant_lease(...))
   |<---- only their rows -----|<-------------------------------|
```

Four sentences to say while drawing it:

1. The cookie holds a signed token; the server verifies it rather than trusting it.
2. The proxy refreshes the session and decides which area the request may enter.
3. One helper turns the session into "who is acting", and every action uses it.
4. The query runs as that user, so the database applies the policy, and nobody else's rows exist.

---

## Five questions to be ready for

**Why not just check `landlord_id` in the application?** Because that is a check somebody can forget
to write. The database applies it to every query, including the ones written next month.

**What is the difference between `getUser()` and `getSession()`?** `getUser()` verifies the token
with the Auth service. `getSession()` decodes the cookie and trusts it. Routing or authorisation on
`getSession()` trusts input.

**Why is the anon key safe in the browser?** It identifies the project, not a person. Every table has
RLS enabled, so a request carrying only the anon key has no `auth.uid()` and matches no policy. The
service role key is the dangerous one, and it never leaves the server.

**Where does the role come from, and why does that matter?** From the `profiles` table. Token
metadata is user-editable through the Auth API, so trusting a role claim in the JWT would let a
tenant promote themselves.

**What happens if the proxy is misconfigured tomorrow?** The wrong page renders, and it shows
nothing, because every query behind it still runs as the signed-in user under RLS.
