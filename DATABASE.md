# Database

Supabase Postgres 17. Five ordered migrations in `supabase/migrations/`:

| File | Contents |
|---|---|
| `…0001_schema.sql` | enums, tables, constraints, indexes |
| `…0002_security.sql` | role helpers, signup trigger, slug trigger, activity triggers, RLS, column privileges, owner functions |
| `…0003_public.sql` | functions anonymous visitors may call |
| `…0004_admin.sql` | super admin snapshot, account and role changes, delete, invites, live count, Realtime |
| `…0005_hardening.sql` | server-only counting with per-IP limits (`ip_hash` columns); storage quota and exact upload sizes |

## Tables
| Table | Purpose | Key rules |
|---|---|---|
| `profiles` | one per auth user: identity, role, status, page details, page style, slug | id = `auth.users.id` (cascade); role `super_admin/editor/viewer`; status `active/on_hold/disabled`; slug unique, set once from the name; wallpaper and table style must exist in `catalog` and not be hidden when changed (trigger; a page keeps one hidden later); colours `#rrggbb` |
| `projects` | the rows of a page | name 1 to 120 chars; status `done/wip`; owner cascade |
| `documents` | a project's files (R2) and links | owner always equals the project's owner (composite FK); link needs an http(s) URL; file needs a server-made key and MIME; `ready` false until the server confirms the upload |
| `page_visits` | one per visitor per page per 30 minutes | visitor code is a random cookie value, never an identity |
| `file_opens` | each document open by a visitor | owner opens are not recorded |
| `edit_sessions` | editing heartbeats (30s) | a gap over 5 minutes starts a new session |
| `activity` | live events that light up stars in the admin sky | written only by triggers; Realtime publication |
| `audit_log` | every admin change | written in the same transaction as the change |
| `admin_allowlist` | emails that become super admins at first sign in | no client access |
| `catalog` | wallpapers, table styles and colour swatches people pick from | key `(kind, id)`; built-ins seeded by migration 7; custom wallpapers are R2 images (`wallpapers/<id>.<ext>`, up to 8 MB, JPG, PNG or WebP), custom tables are a built-in design plus header, line and band colours; readable by everyone, changed only through the admin functions; hidden, never deleted |

Relationships: `auth.users 1-1 profiles 1-n projects 1-n documents`; visits, opens, sessions and
activity belong to a profile; deleting an auth user removes everything of theirs (cascade).

## Functions
**Helpers (used by policies):** `is_super_admin()`, `is_editor()` (active, editor or super admin, terms accepted).

**Owner (authenticated):** `accept_terms()`, `create_file_document(project, name, mime, size)` (checks
100 MB per file and 1 GB per account, makes the key `users/<uid>/projects/<project>/<uuid>.<ext>`),
`mark_document_ready(id, size)` (size must equal the reserved size), `heartbeat_edit_session(id)`.

**Public (anon and authenticated):** `get_public_portfolio(slug)` (public fields only, no email; disabled
returns `{status: "unavailable"}`), `portfolio_stats(slug, range)` with range `7d`, `30d`, `all`.

**Server only (service role):** `record_visit(slug, visitor, ip_hash, viewer)`, `touch_visit(id, visitor)`,
`open_document(id, visitor, ip_hash, viewer)`, with the per-IP limits in SECURITY.md.

**Super admin (each calls `require_super_admin()` first):** `admin_snapshot()` (every analytic the
dashboard shows, in one JSON document), `admin_live_now()`, `admin_set_status(user, status)`,
`admin_set_role(user, role)`, `admin_delete_account(user)` (returns R2 keys to delete), `admin_invited(user, role)`,
`admin_log(text)`. A super admin cannot change or delete themselves.
Catalogue: `admin_catalog_add_table(name, base, header, rule, band)`, `admin_catalog_add_colour(kind, name, hex)`,
`admin_catalog_set_hidden(kind, id, hidden)` (at least one of each kind stays visible),
`admin_catalog_start_wallpaper(name, mime, size)` then `admin_catalog_ready(id, size)` once the server has checked
the upload (or `admin_catalog_abort(id)`). Each change is written to `audit_log`.

All functions are `security definer` with `search_path = ''`. Execute rights are revoked from everyone
and granted back per function (see SECURITY.md for the verified list).

## Analytics definitions
- Dates and hours are IST (`Asia/Kolkata`).
- Visitors: distinct visitor codes. Page views: visits. Time on page: last ping minus start, capped at 30 minutes.
- Time editing: last heartbeat minus start, per session.
- Came back (retention) day N: share of people who signed up 0 to 90 days ago (and at least N days ago)
  with an editing session between day 1 and day N after signup; "prev" uses signups 91 to 180 days ago.
- Cohorts: 12 signup weeks; week w = share with a session in week w after signup; empty weeks have no columns.

## Running migrations
Local: `npm run db:reset` (destroys local data only). Hosted: see DEPLOYMENT.md (`supabase db push`).
Never reset a hosted database.
