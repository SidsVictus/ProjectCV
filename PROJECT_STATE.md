# Project state

- **Project:** Project CV (website; no mobile app)
- **Current phase:** all five phases done locally; deployment steps are the user's (DEPLOYMENT.md)
- **Overall status:** IMPLEMENTED WITH DOCUMENTED LIMITATIONS
- **Last verified checkpoint:** `bash ./verify` green on 2 November 2026 (42 unit and DB tests, 13 E2E, build, types, lint)
- **Branch:** `claude/awesome-einstein-mcblek`, pushed to `SidsVictus/ProjectCV`.

## Phases
| Phase | Status | Evidence |
|---|---|---|
| 0 Discovery and architecture | done | PROJECT_SPEC, ARCHITECTURE, DECISIONS, FEATURE_MATRIX, IMPLEMENTATION_PLAN |
| 1 Backend (Supabase, R2) | done locally | 5 migrations; 27 DB tests; R2 flow tested on the S3 mock |
| 2 Frontend | done | every screen in DESIGN.md section 8, both dashboards, 8 table styles |
| 3 Integration | done locally | 12 E2E journeys against the real local stack |
| 4 Testing, security, fixes | done | TEST_REPORT, SECURITY |

## Blockers and open items
1. Hosted Supabase project not visible to the connector (only `cue-production` is listed), so migrations
   are not applied there. Apply with `supabase link` and `supabase db push` (DEPLOYMENT.md).
2. Google OAuth client, R2 bucket and token, Netlify env vars and visitor access: manual (DEPLOYMENT.md).
3. Legal text is a draft; super admin emails for `admin_allowlist` are needed.

## Assumptions
See PROJECT_SPEC.md section 8 (A1 to A6).

## Database migration status
| Migration | Local | Hosted |
|---|---|---|
| 20261101000001_schema | applied | not applied |
| 20261101000002_security | applied | not applied |
| 20261101000003_public | applied | not applied |
| 20261101000004_admin | applied | not applied |
| 20261102000005_hardening | applied | not applied |

## Resuming
Start the stack (`npm run db:start`), the R2 mock (`node scripts/r2-mock.mjs`), fill `.env.local` from
`npx supabase status`, then run `bash ./verify`. Next actions: the deployment checklist.
