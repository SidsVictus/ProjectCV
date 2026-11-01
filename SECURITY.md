# Security

## Authentication
- Supabase Auth with Google as the only sign-in in the product. Sessions live in httpOnly cookies set by
  `@supabase/ssr`; `src/proxy.ts` refreshes them.
- `/auth/callback` signs out accounts that are on hold or disabled. Every protected page calls
  `requireProfile()` on the server, which sends on hold or disabled sessions to `/auth/blocked` (signs out).
- Roles never come from the client: they live in `profiles.role`, which signed-in users cannot update.

## Authorization (database, fail closed)
- RLS is on for all 9 tables. Tables with no policy (`page_visits`, `file_opens`, `edit_sessions`,
  `admin_allowlist`) are reachable only through functions.
- Owners read and write only their own rows; writes also need `is_editor()` (active, accepted terms,
  editor or super admin), so on hold, disabled and viewer accounts cannot change anything.
- Column privileges: owners may update only page fields; role, status, email, slug and terms are not
  updatable by them (tested).
- File documents can only be created by `create_file_document()`, which builds the storage key itself:
  a user cannot point a document at someone else's object.
- Anonymous visitors reach data only through `get_public_portfolio` and `portfolio_stats`, which return
  public fields (no email). Visit and file-open counting (`record_visit`, `touch_visit`, `open_document`)
  is callable only by the server (service role), never from a browser.
- Verified execute rights (from `pg_proc`, local stack):
  - anon: `get_public_portfolio, portfolio_stats`
  - service role only: `record_visit, touch_visit, open_document`
  - authenticated: the anon ones plus `accept_terms, create_file_document, mark_document_ready,
    heartbeat_edit_session, is_editor, is_super_admin` and the `admin_*` functions, each of which
    refuses non super admins inside the database.
- `/admin` checks the role on the server before rendering, and every admin action is checked again by Postgres.

## Secrets
- Server-only: `SUPABASE_SERVICE_ROLE_KEY` (creating the account for "Add user"; calling the counting
  functions), `VISITOR_HASH_SECRET`, R2 keys.
  Modules that read them import `server-only`.
- Verified: the production browser bundles contain neither the service role key nor any R2 credential
  or SDK (`grep` of `.next/static`).
- `.env*` files are git-ignored except `.env.example`.

## Storage (R2)
- Private bucket. Quota: 100 MB per file and 1 GB per account, enforced in the database (pending uploads
  count; an advisory lock stops concurrent uploads racing past it). Uploads: the server validates type
  (13 MIME types) and size, reserves the size, issues a 5 minute presigned PUT for a server-made key whose
  signature covers `Content-Length` (R2 refuses a different size), then HEADs the object and accepts it only
  with exactly the reserved size and the declared type; otherwise the object and row are removed.
- Downloads go through `/d/<id>`: the database checks the document is ready and its owner is not
  disabled, counts the open, then the server redirects to a 5 minute signed GET (verified: `X-Amz-Expires=300`).
- Deleting a project, a document or an account deletes its objects after the rows are gone; a storage
  failure is logged (orphan) and does not undo the delete.

## Application
- React escapes output. The admin dashboard's own HTML strings pass every user value through `esc()`
  or `textContent` (reviewed line by line). The only `dangerouslySetInnerHTML` is the dashboard's static markup.
- Links: only `http(s)` with a real host are accepted (`javascript:` and others refused, tested).
- Headers: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and a
  Content-Security-Policy from `src/proxy.ts`: scripts only from this site with a fresh nonce per request
  and `'strict-dynamic'` (no `unsafe-eval` in production); connections only to this site, Supabase
  (HTTPS and Realtime WebSocket) and R2; `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
  `frame-ancestors 'none'`; `upgrade-insecure-requests` on HTTPS. Styles allow `'unsafe-inline'` because
  the design uses style attributes (a style nonce would disable them); style injection cannot run script.
- Server actions validate every input with Zod; errors shown to users are plain sentences, details are
  logged on the server without tokens or keys.

## Checks performed
| Check | Result |
|---|---|
| DB tests: allow and deny for anon, owner, other owner, on hold, viewer, super admin; counting limits; quota | 27 pass |
| E2E: CSP header with a changing nonce, no CSP violations on public, owner, picker, stats card and admin screens | pass |
| E2E: on hold blocks sign in but keeps the page, disabled takes it offline, non admins kept out of `/admin` | pass |
| `supabase db lint` (local) | no findings |
| Secrets in browser bundles | none found |
| `npm audit --omit=dev` | 0 vulnerabilities after upgrading Next.js to 16.4.3 (16.3.5 had a critical RCE advisory) |
| `npm audit` (dev tools) | `dicer`, `fast-xml-parser` (in the local R2 mock `s3rver`), `minimatch` (in ESLint): dev only, never deployed |

## Rate limits on counting
Visits and file opens are counted only by the server, which passes an HMAC-SHA256 of the client IP
(`VISITOR_HASH_SECRET`; the IP itself is never stored; Netlify's `x-nf-client-connection-ip` is used).
One network counts at most 3 visits per page per day, 60 visits per hour across all pages, and 3 opens
per document per hour. Over the limit the page and documents still open; they are just not counted.

## Known risks and recommendations
- A determined attacker with many IP addresses can still add counts, within the limits per address.
- The signed `Content-Length` is enforced by R2; the local test mock does not check it, so the size rule
  verified in tests is the server HEAD check plus the database's exact-size rule.
- **Hosted Supabase settings to apply** (not in migrations): turn off the Email provider so Google is the
  only way in, set the Site URL and redirect URLs, keep "Confirm email" on.
- The share link is public by design: anyone with it sees the page, its documents and visitor counts.
- Not claimed: a full penetration test. The checks above are what was run.
