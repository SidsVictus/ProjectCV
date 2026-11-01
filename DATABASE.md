# Database

Supabase Postgres 17. Four ordered migrations in `supabase/migrations/`:

| File | Contents |
|---|---|
| `…0001_schema.sql` | enums, tables, constraints, indexes |
| `…0002_security.sql` | role helpers, signup trigger, slug trigger, activity triggers, RLS, column privileges, owner functions |
| `…0003_public.sql` | functions anonymous visitors may call |
| `…0004_admin.sql` | super admin snapshot, account and role changes, delete, invites, live count, Realtime |

## Tables
| Table | Purpose | Key rules |
|---|---|---|
| `profiles` | one per auth user: identity, role, status, page details, page style, slug | id = `auth.users.id` (cascade); role `super_admin/editor/viewer`; status `active/on_hold/disabled`; slug unique, set once from the name; wallpaper and table style limited to the catalogue; colours `#rrggbb` |
| `projects` | the rows of a page | name 1 to 120 chars; status `done/wip`; owner cascade |
| `documents` | a project's files (R2) and links | owner always equals the project's owner (composite FK); link needs an http(s) URL; file needs a server-made key and MIME; `ready` false until the server confirms the upload |
| `page_visits` | one per visitor per page per 30 minutes | visitor code is a random cookie value, never an identity |
| `file_opens` | each document open by a visitor | owner opens are not recorded |
| `edit_sessions` | editing heartbeats (30s) | a gap over 5 minutes starts a new session |
| `activity` | feed for the admin "Happening now" rail | written only by triggers; Realtime publication |
| `audit_log` | every admin change | written in the same transaction as the change |
| `admin_allowlist` | emails that become super admins at first sign in | no client access |

Relationships: `auth.users 1-1 profiles 1-n projects 1-n documents`; visits, opens, sessions and
activity belong to a profile; deleting an auth user removes everything of theirs (cascade).

## Functions
**Helpers (used by policies):** `is_super_admin()`, `is_editor()` (active, editor or super admin, terms accepted).

**Owner (authenticated):** `accept_terms()`, `create_file_document(project, name, mime)` (makes the key
`users/<uid>/projects/<project>/<uuid>.<ext>`), `mark_document_ready(id, size)`, `heartbeat_edit_session(id)`.

**Public (anon and authenticated):** `get_public_portfolio(slug)` (public fields only, no email; disabled
returns `{status: "unavailable"}`), `record_visit(slug, visitor)`, `touch_visit(id, visitor)`,
`open_document(id, visitor)`, `portfolio_stats(slug, range)` with range `7d`, `30d`, `all`.

**Super admin (each calls `require_super_admin()` first):** `admin_snapshot()` (every analytic the
dashboard shows, in one JSON document), `admin_live_now()`, `admin_set_status(user, status)`,
`admin_set_role(user, role)`, `admin_delete_account(user)` (returns R2 keys to delete), `admin_invited(user, role)`,
`admin_log(text)`. A super admin cannot change or delete themselves.

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
