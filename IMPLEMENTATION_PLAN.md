# Implementation plan

| Task | REQ | Depends | Work | Verify | Status |
|---|---|---|---|---|---|
| T0 | all | | Discovery, spec, matrix, architecture, decisions | docs exist | done |
| T1 | REQ-001..017 | T0 | Migrations: schema, RLS, functions, triggers | `supabase db reset` applies cleanly | planned |
| T2 | REQ-001..017 | T1 | DB tests: RLS allow/deny, RPCs, business rules | `vitest tests/db` green | planned |
| T3 | REQ-007 | T1 | R2 lib + upload/confirm/open flow | tests against s3rver | planned |
| T4 | REQ-019 | | Next.js app, design tokens, CSS from the design system, fonts, assets | build | planned |
| T5 | REQ-001..004 | T4 | Sign in, callback, terms, setup, signed out, legal pages | e2e | planned |
| T6 | REQ-005..013 | T4 | Portfolio, dialogs, pickers, share, preview, public page | e2e | planned |
| T7 | REQ-014 | T6 | Who saw your page card (three.js) with real stats, visit tracking | e2e + DB tests | planned |
| T8 | REQ-015..018 | T1 | Super Admin dashboard port, snapshot RPC, mutations, realtime, CSV | e2e | planned |
| T9 | REQ-021 | | Netlify config, env docs, deployment doc | build | planned |
| T10 | all | T1..T9 | Security review, visual comparison, final docs | TEST_REPORT.md | planned |

Statuses are updated with evidence in PROJECT_STATE.md and TEST_REPORT.md.
