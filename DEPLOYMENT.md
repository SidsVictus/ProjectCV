# Deployment

Nothing has been deployed. This is the checklist for doing it.

## 1. Supabase (your new project)
1. Link and push the migrations from this repo (needs the Supabase CLI and your database password):
   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```
   ```bash
   npx supabase db push
   ```
   This applies the four files in `supabase/migrations/` in order. Do not run `db reset` against it.
2. Add the founders as super admins (SQL editor), before they first sign in:
   ```sql
   insert into public.admin_allowlist (email) values ('founder1@example.com'), ('founder2@example.com');
   ```
   Someone who already signed in can be promoted by another super admin in the dashboard, or once with
   `update public.profiles set role = 'super_admin' where email = '...';`
3. Authentication > Providers: enable **Google** (client ID and secret from step 3), **turn off Email**.
4. Authentication > URL Configuration: Site URL = your site (for example `https://projectcv-q9ht.netlify.app`);
   Redirect URLs: `https://<your-site>/auth/callback`.
5. Database > Replication: confirm `activity` is in the `supabase_realtime` publication (the migration adds it).
6. Run Advisors (Security and Performance) once after the push.

## 2. Google OAuth
Google Cloud Console > APIs & Services > Credentials > OAuth client (Web). Authorized redirect URI:
`https://<project-ref>.supabase.co/auth/v1/callback`. Put the client ID and secret into Supabase (step 1.3).

## 3. Cloudflare R2
1. Create a private bucket (for example `projectcv-documents`). Do not enable public access.
2. Create an API token with Object Read & Write on that bucket only.
3. CORS on the bucket (browsers upload directly):
   ```json
   [{ "AllowedOrigins": ["https://<your-site>"], "AllowedMethods": ["PUT", "GET", "HEAD"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```

## 4. Netlify
A site was created on your Free team: **projectcv-q9ht** (`projectcv` was taken). Rename it or add a domain any time.
1. Connect the GitHub repository `SidsVictus/ProjectCV` (Site configuration > Build & deploy). `netlify.toml`
   sets the build (`npm run build`, publish `.next`, Node 22) and the official Next.js runtime.
2. **Visitor access:** the site currently requires Netlify team login for all deploys. Turn that off for
   production (Site configuration > Access & security > Visitor access) or nobody else can open it.
3. Environment variables (all scopes): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (secret), `NEXT_PUBLIC_SITE_URL` (the final https origin, no trailing slash),
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` (secret), `R2_SECRET_ACCESS_KEY` (secret), `R2_BUCKET_NAME`.
   Never set `R2_ENDPOINT` in production. `NEXT_PUBLIC_*` values are baked in at build time: redeploy after changing them.

## Netlify compatibility
Used features: App Router server rendering, route handlers, server actions, `proxy.ts` (session refresh),
static assets. All are supported by `@netlify/plugin-nextjs` 5. **Not verified on Netlify yet** (no deploy
was made): check sign in, an upload and `/admin` on the first deploy preview.

## Pre-deployment checklist
- [ ] `bash ./verify` green locally
- [ ] Migrations pushed; Advisors clean
- [ ] Google provider on, Email provider off, redirect URLs set
- [ ] Allowlist seeded
- [ ] R2 bucket private, token scoped, CORS set
- [ ] Netlify env vars set, visitor access public, `NEXT_PUBLIC_SITE_URL` correct
- [ ] On the deploy preview: sign in, create a page, upload a file, open the public link in a private window, open `/admin`

## Rollback
Netlify: publish the previous deploy (Deploys > a deploy > Publish). Database: migrations are forward
only; to undo one, write a new migration. Take a Supabase backup before pushing new migrations to a
project with real data.
