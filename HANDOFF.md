# Handoff

**Status: IMPLEMENTED WITH DOCUMENTED LIMITATIONS.** Everything is built and verified against a local
Supabase stack and an S3-compatible R2 mock. It has not run against your hosted Supabase project, live
R2, real Google sign in or Netlify, because this session had no access to them.

## What was built
A Next.js website with every MVP screen: Google sign in, terms, "Tell people who you are", the owner's
portfolio with the three pickers (spool, runway, droplets), add, edit and delete projects with uploads
and links, share, preview, the public read-only page, signed out, legal pages, and the Super Admin
dashboard. Your two dashboards run with their own markup, CSS and three.js scenes (three r128), fed only
by real data. The table styles are your `tables.css`, unchanged.

## Where things are
| What | Where |
|---|---|
| Routes | `src/app/(site)/…`, `src/app/(admin)/admin/` |
| Server actions | `src/app/actions/portfolio.ts`, `admin.ts` |
| Super Admin dashboard (your files) | `src/legacy/admin/` (changes from your originals are in git history: commit "Vendor … (unmodified)" then the patch) |
| Who saw your page card | `src/components/stats/` |
| Design CSS (supplied) | `src/styles/` (`fixes.css` lists the only deviations) |
| Database | `supabase/migrations/`, DATABASE.md |

## Security
RLS on every table, column privileges, security-definer functions with explicit execute grants,
server-made storage keys, 5 minute signed URLs, no secrets in browser bundles, Next.js patched. Details
and known risks: SECURITY.md.

## Tests
`bash ./verify`: green (38 unit and DB tests, 12 end-to-end journeys, build, types, lint). TEST_REPORT.md.

## Not verified
Google sign in, live R2, the hosted Supabase project, Netlify runtime behaviour, reduced motion.

## What you need to do
1. Give the Claude GitHub App access to `SidsVictus/ProjectCV` so the branch can be pushed.
2. Follow DEPLOYMENT.md: push migrations, seed super admin emails, Google provider on and Email off,
   R2 bucket and token, Netlify env vars, turn off Netlify visitor login on `projectcv-q9ht`.
3. Have the Terms and Privacy pages reviewed.
4. On the first deploy preview: sign in, upload a file, open the public link in a private window, open `/admin`.

## Run locally
See README.md (`npm install`, `npm run db:start`, `.env.local`, `node scripts/r2-mock.mjs`, `npm run dev`).
