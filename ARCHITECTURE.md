# Architecture

```
Browser ── Next.js 16 App Router (Netlify) ──► Supabase (Postgres + RLS, Auth, Realtime)
   │                │                          
   │                └── server-only: R2 presign / HEAD / delete (S3 API), service role (add user only)
   └── presigned PUT / GET ──────────────────► Cloudflare R2 (private bucket)
```

## Directory structure
```
src/
  app/                    routes (see below)
  app/actions/            server actions: portfolio.ts (profile, style, projects, uploads, editing heartbeat), admin.ts
  components/             React UI (auth, setup, portfolio, pickers, dialogs, stats)
  legacy/admin/           the Super Admin dashboard, original files (D1)
  lib/supabase/           browser, server, admin clients; env
  lib/                    r2.ts, r2-rules.ts, validation.ts (Zod), cv.ts (readability rule, catalogues), admin/pcvData.ts (snapshot to dashboard data)
  styles/                 tokens.css, bundle.css, prototype.css, tables.css (supplied), fixes.css (documented deviations)
supabase/migrations/      ordered SQL migrations
tests/unit, tests/db      vitest (unit; RLS and RPC tests against the local stack)
scripts/r2-mock.mjs       local S3-compatible stand-in for R2 (dev and tests)
tests/e2e                 Playwright
```

## Routes
| Route | Who | What |
|---|---|---|
| `/` | anyone | Sign in, or redirect a signed-in user to terms, setup or portfolio |
| `/auth/callback` | OAuth | Exchanges the code; refuses on hold or disabled accounts |
| `/terms` | signed in | Accept terms (once) |
| `/legal/terms`, `/legal/privacy` | anyone | Legal pages |
| `/setup` | editor | Tell people who you are (also "Edit my details") |
| `/portfolio` | editor | Owner page with tools, pickers, dialogs |
| `/portfolio/preview` | editor | Exactly as viewers see it |
| `/p/[slug]` | anyone | Public read-only page |
| `/d/[id]` | anyone | Open a document (authorize, count, redirect) |
| `/api/visit` | anyone | Start and ping a page visit |
| `/admin` | super admin | Super Admin dashboard |
| `/signed-out` | anyone | See you soon |
| `/read-only` | viewer role | Explains a view only account |
| `/auth/blocked`, `/auth/signout` | signed in | End a blocked session / sign out (POST) |

## Auth and authorization
Supabase Auth with Google only. `proxy.ts` refreshes the session cookie. Every protected page calls
`requireProfile()` on the server, which reads the profile and enforces status and role. The database
enforces the same rules again: RLS write policies require `is_editor()` (active, role editor or
super admin), admin functions require `is_super_admin()`.

## Data flow
- Owner reads and writes go through the RLS-scoped server client in server actions.
- Public reads use security-definer functions that return public fields only (D5).
- The CSV export is built in the browser from the same snapshot. Analytics are raw events (`page_visits`, `file_opens`, `edit_sessions`, `activity`) aggregated in
  SQL by `admin_snapshot()` and `portfolio_stats()`.
- The admin live feed subscribes to `activity` inserts via Supabase Realtime (RLS: super admins).

## Storage (R2)
Keys `users/<owner>/projects/<project>/<uuid>.<ext>`; no user filename in the key. MIME allowlist and
size checked before presigning; after upload the server HEADs the object (exists, not empty, declared type) before it becomes visible. Private bucket, 5 minute presigned
URLs, credentials server-only.

## Error handling and logging
Server actions return `{ ok: false, error }` with plain sentences; unexpected errors are logged on
the server with `console.error` (no secrets, no tokens) and shown as a generic sentence.

## Testing
See TEST_REPORT.md. `bash ./verify` runs types, lint, unit and DB tests, build and e2e.
