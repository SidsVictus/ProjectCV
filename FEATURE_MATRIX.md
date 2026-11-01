# Feature matrix

Status: **V** implemented and verified by the named test · **P** implemented, partly verified (reason given).
Tests: `db` = `tests/db/rls.test.ts`, `unit` = `tests/unit/cv.test.ts`, `ed` = `tests/e2e/editor.spec.ts`,
`ad` = `tests/e2e/admin.spec.ts`, `rs` = `tests/e2e/responsive.spec.ts`.

| ID | REQ | Role | Screens / code | Data and rules | Evidence | Status |
|---|---|---|---|---|---|---|
| F-01 Google sign in, sign out | 001 | all | `/`, `GoogleButton`, `/auth/callback`, `/auth/signout`, `/signed-out` | Supabase Auth; on hold and disabled refused | ed: sign out lands on See you soon; ad: on hold redirected with message | **P**: Google itself needs real OAuth credentials; the session, callback checks and sign out are verified |
| F-02 Terms once, legal pages | 002 | editor | `/terms`, `/legal/terms`, `/legal/privacy` | `accept_terms()`; writes need accepted terms | ed: first sign in; db: projects need accepted terms | **V** (legal text is a draft for review) |
| F-03 Setup and edit details | 003, 004 | editor | `/setup`, `SetupForm` | name and headline required; slug made once | ed: validation, live preview, saved; db: slug stable and unique | **V** |
| F-04 Projects add, edit, delete | 005 | editor | `PortfolioEditor`, `ProjectDialog`, `DeleteDialog` | RLS owner only; name required | ed: add, persist after reload, delete; db: other owners refused | **V** |
| F-05 Completed / In progress | 006 | editor | status segmented control, pills | enum `done/wip` | ed: Completed pill shown | **V** |
| F-06 Documents: upload or link | 007 | editor, visitor | `ProjectDialog`, `/d/[id]`, `lib/r2.ts` | server-made keys, type checks, 100 MB per file and 1 GB per account, exact size, HEAD confirm, 5 min signed GET | ed: real upload via presigned PUT, visitor opens bytes, signed link 300s, object deleted with project; db: key namespace, spoofing refused | **P**: verified against the S3-compatible local mock, not live R2 |
| F-07 Wallpaper picker | 008 | editor | `WallpaperPicker` (runway) | 15 ids, check constraint | ed: keyboard pick, saved | **V** |
| F-08 Table style picker | 009 | editor | `TablePicker` (spool), `tables.css` as supplied | 8 ids | ed: keyboard pick, saved; visual compare with the 8 supplied screenshots | **V** |
| F-09 Colours, readability rule | 010 | editor | `ColourPanel`, `cvVars`, `paneAlpha` | hex constraint; 7:1 rule | ed: saved; unit: 66% default, 7:1 over black and white, warning case | **V** |
| F-10 Share dialog | 011 | editor | `ShareDialog` | stable slug link | ed: link text | **V** |
| F-11 Public page | 012 | visitor | `/p/[slug]`, `ViewerPage` | public fields only; disabled unavailable | ed: no edit controls, no email; ad: on hold visible, disabled unavailable, deleted 404 | **V** |
| F-12 Preview | 013 | editor | `/portfolio/preview` | same as public, owner visit not counted | ed: banner, no edit controls | **V** |
| F-13 Who saw your page (three.js) | 014 | editor, visitor | `PageStats`, `ribbon.ts`, `whosaw.css` | `portfolio_stats`, `record_visit`, owner excluded | ed: 1 visitor and 1 open counted, card shows them, 30 days switches to weeks; db: dedupe, owner excluded | **V** |
| F-14 Super admin dashboard (three.js) | 015, 018 | super admin | `/admin`, `src/legacy/admin/*`, `pcvData.ts` | `admin_snapshot()`; Realtime on `activity` | ad: real totals, no sample text, no NaN, no page errors, live event arrives; unit: mapping | **V** |
| F-15 Access control | 016 | super admin | drawer, add user, delete | `admin_set_status/role`, `admin_delete_account`, `admin_invited`; never on self | ad: hold, disable, role, self refused, add user, delete everywhere; db: non admins refused, audit rows | **V** |
| F-16 Audit log | 017 | super admin | Admin activity list | written in the same transaction | ad and db: entries with actor and text | **V** |
| F-17 Responsive, keyboard, reduced motion | 019 | all | design CSS | | rs: no horizontal scroll at 390px on owner, public, setup, admin; stats card fits; pickers driven by keyboard in ed | **P**: reduced motion relies on the supplied CSS and scripts, not separately tested |
| F-18 No em or en dashes in UI copy | 020 | all | copy | | `grep` of `src/` for U+2013 and U+2014: none in UI strings | **V** |
| F-19 Netlify preparation | 021 | ops | `netlify.toml`, DEPLOYMENT.md | | build passes locally | **P**: no Netlify deploy made (not authorised) |
