# Test report

Run on 1 November 2026, in the cloud container used to build the project.

## Environment
- Node 22.23, Next.js 16.4.3, Chromium (Playwright 1.63, pre-installed build via `PW_CHROMIUM_PATH`).
- Supabase CLI 2.122 local stack (Postgres 17, Auth, PostgREST, Realtime) in Docker, all migrations applied by `supabase db reset`.
- R2: `s3rver` local mock (same S3 API: presigned PUT and GET, HEAD, multi-delete, CORS).
- Not available: live Google OAuth, the hosted Supabase project, live Cloudflare R2, Netlify.

## Commands and results
| Command | Result |
|---|---|
| `bash ./verify` | **green** (all steps below; rerun after the security hardening) |
| `tsc --noEmit` | pass |
| `eslint .` | pass |
| `vitest run` (unit + DB) | 42 of 42 pass (15 unit, 27 DB) |
| `next build` | pass, 18 routes + proxy |
| `playwright test` | 13 of 13 pass (desktop 1440x900; 3 also at 390x844) |
| `supabase db lint --local` | no findings |
| `npm audit --omit=dev` | 0 vulnerabilities |

## What the suites cover
- **DB (23):** profile creation and roles, allowlist, own-row visibility, column privileges (role, status,
  slug, terms, email not updatable), slug stability and uniqueness, terms gate, cross-owner reads, updates,
  deletes and spoofed inserts refused, on hold and viewer refused, link URL scheme, client-chosen storage
  keys impossible, file type and project ownership checks, public page fields (no email, ready documents
  only), on hold vs disabled, visit dedupe, owner not counted, stats per range, analytics tables closed,
  admin functions refused to non admins and anonymous visitors, snapshot shape, status and role changes
  with audit, self change refused, delete everywhere with storage keys returned, empty cohorts blank.
- **Unit (15):** readability rule (66% default, 7:1 over black and white, warning case), profile view,
  link normalisation, validation of profile, links, styles and uploads, college grouping, snapshot mapping.
- **E2E editor (5):** first sign in through terms and setup; projects with a real upload and a link;
  table style, wallpaper and colours saved; share link; preview; public page as an anonymous visitor
  (no edit controls, no email); file opened through a 5 minute signed link with the real bytes; visit
  and open counted and shown in the card; delete removes rows and the stored object; route protection;
  sign out; 404s.
- **E2E admin (1 long journey):** real totals, no sample text, no NaN, no page errors; on hold keeps the
  page public and blocks the owner; disabled takes the page offline; role change; self change refused;
  add user; delete everywhere; a new project arrives in the live feed over Realtime; CSV export.
- **DB hardening (4):** browsers cannot call counting functions; per-IP visit and open limits; 100 MB and
  1 GB quota with pending uploads counted; exact upload size.
- **E2E CSP (1):** header present, nonce changes per request, no `unsafe-eval`, no CSP violations or page
  errors on public page, stats card (three.js), owner page, table picker and admin dashboard (three.js, Realtime).
- **E2E responsive (6):** no horizontal scroll at 390px on owner, public, setup and admin pages; stats
  card fits a phone; sign in screen.

## Defects found and fixed during testing
| Defect | Fix |
|---|---|
| Text colour panel half off screen, "Done" unreachable on a 900px window (also in reference 08) | entrance animation ends at the centred position (`src/styles/fixes.css`) |
| Fallback serif font on some text | wrapped the site in `.pcv-root` like the prototype |
| Who saw your page card in lime, overlapping labels, no glass blur | card scope gets the design's body text settings; iris moved onto the card; build minifier dropped `backdrop-filter`, fixed by declaration order |
| Retention terrain drew empty signup weeks as 0% | empty cohorts return no values |
| "Edit details" underlined | link styling |
| Next.js 16.3.5 critical advisory (RCE) | upgraded to 16.4.3 |

## Visual comparison
Captured at 1440x900 and compared by eye with `reference/01` to `13`, the 8 table style screenshots and
the two supplied dashboards. Layout, spacing, colours and components match. Differences: real numbers
instead of sample ones; Boska renders as the real font (some references show a serif fallback); the
colour panel is centred (fix above). Not a pixel diff: no automated image comparison was run.

## Not run
- Google sign in itself, live R2, the hosted Supabase project, a Netlify deploy (no credentials or access).
- Reduced motion and screen reader passes beyond the semantic checks in the E2E suite.
