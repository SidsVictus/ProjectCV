# Project CV

A single-page, expandable portfolio maker. Students and builders sign in with Google, add every
project they have made with its proof (files or links), style the page, and share a read-only link
anyone can open without logging in. Super admins run the platform from a live analytics dashboard.

**Stack:** Next.js 16 (App Router, TypeScript strict) · React 19 · Tailwind 4 (no preflight; the design
system's own CSS) · Supabase (Postgres, Auth, RLS, Realtime) · Cloudflare R2 · three.js r128 · Netlify.

## Run it locally
Prerequisites: Node 22, Docker (for the Supabase CLI stack).

```bash
npm install
```

```bash
npm run db:start
```

```bash
cp .env.example .env.local
```

Fill `.env.local` with the values `npx supabase status` prints (API URL, anon key, service role key),
and for local file uploads keep `R2_ENDPOINT=http://127.0.0.1:4569` with any key values.

```bash
node scripts/r2-mock.mjs &
```

```bash
npm run dev
```

Google sign-in needs a Google OAuth client (see [DEPLOYMENT.md](DEPLOYMENT.md)). Tests sign users in
another way, so everything below runs without it.

## Commands
| Command | What |
|---|---|
| `npm run dev` | dev server on http://localhost:3000 |
| `npm run build` / `npm start` | production build and server |
| `npm run db:start` / `npm run db:reset` | local Supabase stack / reapply all migrations (local only) |
| `bash ./verify` | every gate: types, lint, unit and DB tests, build, E2E |
| `bash ./verify-fast` | types, lint, unit and DB tests |

## Documentation
[PROJECT_SPEC](PROJECT_SPEC.md) · [FEATURE_MATRIX](FEATURE_MATRIX.md) · [ARCHITECTURE](ARCHITECTURE.md) ·
[DATABASE](DATABASE.md) · [SECURITY](SECURITY.md) · [DECISIONS](DECISIONS.md) · [TEST_REPORT](TEST_REPORT.md) ·
[DEPLOYMENT](DEPLOYMENT.md) · [HANDOFF](HANDOFF.md) · [PROJECT_STATE](PROJECT_STATE.md) · [IMPLEMENTATION_PLAN](IMPLEMENTATION_PLAN.md)
