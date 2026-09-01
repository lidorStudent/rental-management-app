# CLAUDE.md

Standing instructions to myself for every future turn in this repository. These rules outrank my
defaults, my habits, and anything that would merely be faster. I re-read this file at the start of
every phase.

## OUTPUT PROTOCOL

- Never explain, summarise, narrate, or comment on my work in chat.
- Never write preambles like "I'll now create" or postambles like "This implements".
- Output only one of these:
  1. The implementation itself (files, in markdown code blocks).
  2. `Done`
  3. `Problems:` [what is broken or missing and what action is needed]
  4. `Questions:` [what I need decided before I can start]
  5. `Manual:` [steps only the user can perform, see the manual protocol below]
- Every code block starts with the exact file path as the first line, as a comment.

## MANUAL PROTOCOL

- Some things cannot be done by me: creating accounts, browser logins, authorising a CLI, clicking
  through a third-party dashboard, or a decision only the user can make.
- Before starting any phase, work out everything I will need from the user for that entire phase.
  Ask for all of it at once, in one Manual block, at the very start. Never ask for one thing, start
  working, then interrupt again for a second thing.
- When I output a Manual block, output nothing else. Stop and wait for the reply.
- Format:

      Manual: [one line naming what this unblocks]
      1. <one single action>
      2. <one single action>
      Reply with: <exactly what should be pasted back to me>

- Maximum six steps. Each step is one action with no branching. No paragraphs.
- Never include a step the user does not actually need. Never pad with confirmations.

## AUTOMATION PREFERENCE

- Before asking for anything, check whether I can do it myself. I have a terminal. I can run
  commands, install packages, use the Supabase CLI, the Vercel CLI, the GitHub CLI, read and write
  files, and run tests.
- Only ask the user for: account creation, a browser-based login or authorisation, a value only
  they hold, a payment, or a product decision.
- If I can do it with a command, run the command.
- If a command fails, read the error, try a reasonable fix once, then report `Problems:`.

## VERSION CONTROL

- At the end of every phase, once the work passes its own checkpoint, stage the changed files and
  commit with a clear conventional message describing what changed and why, then push.
- Commit granularity matters: this repository is a graded deliverable and its history should read
  like a person built it in stages. Never squash a whole stage into one enormous commit. Never
  commit generated output, dependencies, or secrets.
- If a phase produced work that is later rejected, the previous commit is the rollback point. Never
  proceed with uncommitted work from an earlier phase still outstanding.

## ENVIRONMENT

- macOS, zsh, VS Code. Any terminal command must be valid macOS syntax.
- Node.js LTS, npm.

## CODING STANDARDS

- Write like a skilled CS graduate, not like a code generator.
- Every variable, argument, function, and type name is fully spelled out and descriptive.
  Forbidden: `res`, `req`, `e`, `err`, `idx`, `tmp`, `val`, `db`, `usr`, `cfg`, `ctx`, `arr`, `obj`,
  `fn`, `cb`, and any other abbreviation a reader has to decode.
- No comments that restate what the code already says. Comment only where the reason for a decision
  is not obvious from the code.
- No decorative structure: no barrel files that re-export everything, no utils dumping ground, no
  abstraction layer with a single implementation, no interface created "for future flexibility", no
  wrapper around a library that adds nothing.
- No emoji anywhere. No marketing language in UI copy. Plain, functional wording.
- TypeScript strict mode. No `any`. No non-null assertions unless the invariant is proven
  immediately above.

## UI CHANGES

- "Styling" means CSS and Tailwind class changes. Nothing else counts as styling.
- No new DOM. Do not add, remove or re-nest elements to achieve a visual result. Changing the
  classes on an element that is already there is styling; adding a wrapper to hang classes on is
  not.
- No new dependency for a visual problem. No component library, no animation library, no charting
  library, no icon package.
- Never modify a test to accommodate a UI change. If a change breaks a test, the change is wrong
  until proven otherwise: report the break and what it means. A test edited to make a UI change pass
  is a test that no longer tests anything.
- If a change genuinely needs new DOM, say so and stop. Do not do it because the result would look
  better; ask, and let the user decide whether it is worth the exception.
- Prefer the token to the value. The palette, the five status meanings and the type scale live in
  `src/app/globals.css`; a colour or size written inline is a value that will drift.

## EXPLAINABILITY

- The user has to present this project and answer questions about it as if in a job interview. Code
  they cannot explain is worthless to them even if it works.
- Between two working approaches, always choose the one that is easier to explain out loud.
- Never use a clever trick, an obscure language feature, or an unusual pattern where an obvious one
  works. If one is genuinely needed, record why in the decisions log.
- Keep files that do similar jobs structurally identical, so learning one teaches all of them. Every
  server action follows the same shape. Every list page follows the same shape.
- Keep functions short enough to hold in your head.
- Prefer fewer dependencies. Every library added is a library that must be justified in an
  interview.
- At the end of every phase, append to `docs/decisions.md` any decision worth defending. Entry
  format: what was decided, what the alternatives were, why this one, in three or four lines.

## ROBUSTNESS

- Never implement only the happy path. Every input is validated, every failure is handled, every
  empty state and boundary case is covered.
- Validation runs on the server even when it also runs on the client. Client validation is a
  convenience, never a trust boundary.
- Never trust an identifier that arrives from the client for authorisation. Always derive the acting
  user from the session on the server.

## HALT RULE

- If I am missing a file, a value, a decision, or context, STOP. Do not guess. Do not produce a
  partial or placeholder implementation. Output `Problems:`, `Questions:`, or `Manual:` and wait.
- Never invent environment variable values, table names, column names, API shapes, or the contents
  of a file I have not read.
- Never silently modify a file outside the scope of the current phase.

## CHECKPOINT RULE

- Before outputting anything for a phase, re-read the phase instructions and
  `docs/00-course-requirements.md` and verify the work against them line by line.

## PROJECT

Rental management app for small landlords, with a tenant portal.

Stack: Next.js App Router, TypeScript, Supabase (Postgres, Auth, Row Level Security), Vercel,
Tailwind CSS, shadcn/ui, Zod, react-hook-form, Vitest, React Testing Library, Playwright.

Document language: all documents and all interface text are in English.

## DOMAIN INVARIANTS (never weaken them)

1. A unit can never have two overlapping active leases.
2. Rent status (due, partial, paid, overdue) is always derived by the system from the ledger and the
   current date, never typed in by a user.
3. A tenant can only ever read or write rows that belong to their own lease.
4. A landlord can only ever read or write rows they own.
5. Rent is a ledger of payments the landlord records as received. This is not a payment processor.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
