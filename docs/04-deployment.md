# Deployment

Where this application runs, what it needs to run, and what to look at when the deployed copy
misbehaves and the one on your own machine does not.

| | |
| --- | --- |
| Live application | https://rental-management-app-wine.vercel.app |
| Repository | https://github.com/lidorStudent/rental-management-app |
| Health check | https://rental-management-app-wine.vercel.app/api/health |

## 1. How the deployment is configured

**Hosting.** Vercel, project `rental-management-app` in the personal scope
`lidors-projects-053d56ca`. The project is connected to the GitHub repository, so every push to
`main` produces a deployment and a push to `main` produces a production one. Deployments can also be
made from a terminal with `vercel deploy --prod`, which is how this project's are usually made,
because it reports the result rather than leaving it in a browser tab.

**Framework.** `vercel.json` contains one line, `"framework": "nextjs"`. It is there because the
Vercel project was created from the command line before any code existed, so it defaulted to a
static site and the first deployment failed on an empty output directory. A committed file says how
the repository is deployed; a setting clicked in a dashboard does not travel with the code.

**Build.** Vercel runs `npm install` and then `npm run build`, which is `next build`. The build type
checks the whole project, so a type error fails the deployment rather than reaching production.

**Runtime.** Everything is server rendered on demand except `/register` and the not-found page. The
proxy, `src/proxy.ts`, runs before every request; server actions run as functions. Nothing is
statically generated that depends on a signed-in user, because nothing about a signed-in user is
known at build time.

## 2. Environment variables

Three variables, set in the Vercel project for the Production and Preview environments. There are no
others, and nothing else is needed to run the application.

| Variable | Visibility | What it is | Where it comes from |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public, in the browser bundle | The address of the Supabase project the application talks to | Supabase dashboard, Project Settings, Data API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public, in the browser bundle | The anonymous key. It identifies the project, not a person, and grants nothing by itself: every table has Row Level Security and a request carrying only this key matches no policy | Supabase dashboard, API Keys, `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret, server only** | Bypasses Row Level Security entirely. One server action uses it, to create a tenant's account through the Auth admin API | Supabase dashboard, API Keys, `service_role secret` |

Three things about these are worth being able to say out loud.

**The first two are meant to be public.** They are compiled into the JavaScript every visitor
downloads, and that is safe for the reason stated above: `tests/anonymousAccess.test.ts` proves it by
querying every table and every view with that key and no session, and getting nothing back.

**The third must never carry the `NEXT_PUBLIC_` prefix.** A variable with that prefix is inlined into
the browser bundle, so prefixing the service role key would hand every visitor the ability to read
and write every landlord's data. It is read in exactly one file,
`src/lib/supabase/adminClient.ts`, which begins with `import "server-only"` so that importing it
into a client component is a build error rather than a leak.

**They are set for Preview as well as Production**, so a preview deployment of a branch works.
Preview points at the same Supabase project as production, which is a deliberate simplification for
a project of this size and is recorded as such: a preview deployment writing to the production
database is a real limitation, and the reason previews are not part of anybody's workflow here.

Locally the same three live in `.env.local`, which is gitignored. `.env.example` lists all of them
with an explanation and no values.

## 3. Two databases, and which is which

| | Production | Tests |
| --- | --- | --- |
| Supabase project | `rental-management-app` | `rental-management-app-test` |
| Reference | `jarkqjrfuzvvrbietxve` | `attddpdrjaftdbgzlzmv` |
| Region | `eu-central-1` | `eu-central-1` |
| Named in | `.env.local`, and the Vercel project | `.env.test` |
| Used by | The deployed application, and `npm run dev` | `npm run test:db`, `npm run test:e2e`, `npm run db:seed` |

They exist separately because the authorisation tests sign real users in and write real rows. Two
free projects is the whole of the free allowance, which is why there is no third for previews.

Three guards keep the tests off production, and all three were tested by pointing `.env.test` at
production on purpose and watching them refuse:

- `tests/support/testDatabase.ts` throws before building a client if the project reference is the
  production one.
- `playwright.config.ts` throws at configuration time for the same reason.
- `supabase/seed.ts` refuses to seed production unless `--confirm-production` is passed, which is
  what `npm run db:seed:production` does deliberately.

Migrations are applied to both, test first, with `supabase db push --linked`. See
[supabase/README.md](../supabase/README.md).

## 4. Keeping the project awake

A Supabase project on the free plan is paused after about a week without activity. A paused project
is a graded application that does not load, which is the single most likely way this deployment
fails on a day nobody is working on it.

Two layers:

1. **The application being used.** Any page load queries Postgres.
2. **`/api/health`, called daily** by `.github/workflows/health-check.yml`. The endpoint makes a real
   query rather than answering statically, because a static answer would keep Vercel warm and let
   the database sleep anyway. It needs no session, exposes nothing, and is the one path the proxy
   lets through unauthenticated. The workflow fails loudly if the answer is not `status: ok`, so a
   paused project shows up as a red mark in the repository rather than as a surprise.

`GET /api/health` answers:

```json
{ "status": "ok", "database": "reachable", "checkedAt": "2026-08-26T10:04:31.611Z" }
```

with `503` and `"status": "unavailable"` if the query fails.

**A third layer was considered and rejected.** An external uptime monitor would add nothing that
matters here: the workflow runs daily against a seven-day pause window, so it would take a week of
consecutive missed runs to matter, and GitHub only disables scheduled workflows in a repository with
no activity for sixty days. If this project were to sit untouched for two months, that is the thing
to revisit.

## 5. When the deployed application fails and localhost works

The list, in the order worth checking.

| Symptom | First thing to check | Why it happens |
| --- | --- | --- |
| Every page errors, or sign-in hangs | `curl https://rental-management-app-wine.vercel.app/api/health`. A `503`, or no answer at all, means the database rather than the application | The Supabase project has been paused for inactivity. Resume it from the Supabase dashboard; it comes back in a minute or two |
| A page that reads data is empty, but sign-in works | Whether the deployment is pointed at the right Supabase project: `vercel env ls --project rental-management-app` | Locally `.env.local` is used; on Vercel the project's variables are. An application talking to an empty database looks broken and is not |
| The build fails on Vercel but `npm run build` works locally | The build log's TypeScript step, and whether `src/types/database.ts` matches the deployed schema | The generated types are committed. If a migration was applied without regenerating them, the code and the database disagree and only the build notices |
| Sign-in refuses a password that works locally | Which Supabase project the two are pointed at | The seeded accounts exist in both projects with the same password, but a password changed in one is not changed in the other |
| A newly registered landlord cannot sign in | Email confirmation in the Supabase project's Auth settings | There is no email service in this product. Confirmation must stay off, and it is set in `supabase/config.toml` and pushed with `supabase config push` |
| Something works signed out and not signed in, or the reverse | The proxy matcher in `src/proxy.ts` | Every path except `/api/health` and Next's own assets goes through it. A path added to the matcher's exclusions stops being guarded |
| A server action fails only in production | The Vercel function logs for `SUPABASE_SERVICE_ROLE_KEY` | It is the one variable a local `.env.local` may have and a Vercel environment may not. Creating a tenant account is the action that needs it |
| A page is stale after a write | Whether the action calls `revalidatePath` for that route | Nothing is cached deliberately, but a server component's output is reused until the path is revalidated |

The general rule: the application and the database fail in different ways. `/api/health` tells you
which one you are looking at in one request, and that is what it is for.

## 6. Deploying, and checking that it worked

```sh
npm run build          # the same build Vercel runs, including the type check
vercel deploy --prod --yes

PLAYWRIGHT_BASE_URL=https://rental-management-app-wine.vercel.app \
  npx playwright test e2e/deploymentSmoke.spec.ts
```

The smoke check is read only and signs in as a seeded landlord and a seeded tenant. Without
`PLAYWRIGHT_BASE_URL` it is skipped, so it never runs as part of the ordinary suite, which creates
and deletes data.

Last run: **2026-08-28**, seven checks passed against the live address in 19.3s: the health endpoint,
the signed-out redirect, the session cookie's flags, a landlord through the dashboard, properties, a
tenancy, its statement, the rent overview and the maintenance list, a tenant through their own
tenancy, lease, payments and a refused landlord route, and the two header checks SEC-01 and SEC-02,
which can only be made where the platform actually serves them. The run log for every execution is
kept under MAN-05 in [docs/03-test-specification.md](03-test-specification.md).
