# ProjectCV: project specification

Sources: `ProjectCV_MVP_V1.docx` (MVP), `ProjectCV-Full-Design-System.zip` (DESIGN.md, tokens,
components, prototype, reference screenshots), `projectcv-superadmin-dashboard.zip` (Super Admin
dashboard, three.js) and `user-mini-dashboard_for_who_say_your_page.zip` ("Who saw your page"
card, three.js). Owner instruction: the two dashboards go into the product as they are.

## 1. Overview
A single-page, expandable portfolio maker. A student or builder signs in with Google, adds every
project (name, timeline, description, status, documents), styles the page (wallpaper, table style,
colours) and shares a read-only link that anyone can open without logging in.

## 2. Users and roles
| Role | Who | Can |
|---|---|---|
| Super admin | Platform operators | Everything an editor can, plus the admin dashboard, account status, roles, add and delete accounts |
| Editor | Portfolio owner (default role on first sign in) | Build, style and share their own page |
| Viewer (account role) | A person invited to read only | Sign in, but cannot create a portfolio |
| Visitor (anonymous) | Anyone with a share link | Read a page, open its documents, see its visitor stats |

Account status: **Active** (normal), **On hold** (cannot sign in or edit; share link still works),
**Disabled** (cannot sign in; share link shows the page is unavailable).

## 3. Requirements
Priority: M = mandatory, I = important, O = optional.

| ID | Requirement | P |
|---|---|---|
| REQ-001 | Sign in with Google (Supabase Auth), sign out | M |
| REQ-002 | Terms and Privacy pages; accept terms once before the page is created | M |
| REQ-003 | Setup "Tell people who you are": name and headline required; org, graduation year, location, about (160 chars), LinkedIn, GitHub, website optional; live preview | M |
| REQ-004 | Personal portfolio page auto-created after first sign in; editable details any time | M |
| REQ-005 | Add, edit, delete projects (name required, timeline, description); unlimited | M |
| REQ-006 | Completed / In progress status on every project | M |
| REQ-007 | Documents per project: upload a file (R2) or paste a link; remove; opens in a new tab for viewers | M |
| REQ-008 | Wallpaper picker (15 wallpapers, live try-on, apply) | M |
| REQ-009 | Table style picker (8 styles, live preview) | I |
| REQ-010 | Text, glass and line colours with the readability rule and contrast warning | I |
| REQ-011 | Share dialog: stable read-only link, copy, WhatsApp, LinkedIn, Email, open as viewer | M |
| REQ-012 | Public page `/p/<slug>`: no login, no edit controls, viewer banner, "Create one for yourself" | M |
| REQ-013 | Preview mode: page exactly as viewers see it, "Back to editing" | M |
| REQ-014 | Visitor stats ("Who saw your page" card, three.js ribbon): visitors, avg time, files opened, visits per day/week/month, most opened files; 7 days / 30 days / All time; owner visits not counted | M |
| REQ-015 | Super Admin dashboard (`/admin`, three.js) with every analytic: growth, activity, engagement, retention, reach, customisation, accounts | M |
| REQ-016 | Access control: Active / On hold / Disabled; roles; add user; delete account (removes portfolio, documents in R2, share link) | M |
| REQ-017 | Audit log of every admin change, shown in "Admin activity" | M |
| REQ-018 | Live feed and "people editing now" from real events | I |
| REQ-019 | Responsive to 390px, no visible scrollbars, reduced motion, keyboard access | I |
| REQ-020 | No em or en dashes in UI copy | M |
| REQ-021 | Netlify deployment preparation (not deployment) | M |

## 4. Business rules
- BR-1 A super admin cannot change their own status or role, or delete themselves.
- BR-2 At least one active super admin must remain.
- BR-3 On hold keeps the share link alive; Disabled turns it off.
- BR-4 The share link (slug) is created once at setup and never changes.
- BR-5 The owner's own visits and file opens are not counted.
- BR-6 Brand colours never appear inside a CV page; the owner's colours do.
- BR-7 The first super admins come from `public.admin_allowlist` (emails), seeded by the operator.

## 5. Data
Profiles (identity, role, status, page style), projects, documents (file in R2 or link), page
visits, file opens, edit sessions, activity events, audit log. See DATABASE.md.

## 6. Security
RLS on every table, fail closed. Owners write only their own rows; anonymous reads go through
narrow security-definer functions that return public fields only. R2 keys and the service-role key
never reach the browser. Admin functions check the caller's role inside the database.

## 7. Non-goals (V1)
Viewer reports or moderation, email delivery (invites, notifications), PDF export (the dashboard
exports CSV), custom domains, payments.

## 8. Assumptions
- A1 "Viewer" as an account role means a signed-in person who cannot build a page.
- A2 Superseded by the owner on 2 November 2026: 100 MB per file and 1 GB per account (security hardening).
- A3 Colleges for the admin sky are grouped from the free-text "College or organisation" field
  (top 10 named, the rest "Other organisations").
- A4 "Came back" (retention) means an editing session that started at least one day after signup.
- A5 Terms and Privacy text is a plain-language draft; it needs legal review before launch.
- A6 Added users (admin "Add user") get an account for their email; they sign in with Google using
  that email. No email is sent.

## 9. Unresolved questions (non-blocking)
- Q1 Real Google OAuth client and hosted Supabase / R2 credentials (needed for live verification).
- Q2 Founders' super admin emails for the allowlist.

## 10. Acceptance criteria
Each REQ is accepted when its row in FEATURE_MATRIX.md has passing evidence in TEST_REPORT.md.
