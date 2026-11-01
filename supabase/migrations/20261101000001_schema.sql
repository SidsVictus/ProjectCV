-- ProjectCV schema: accounts, portfolios, projects, documents, analytics events, audit log.

create type public.app_role as enum ('super_admin', 'editor', 'viewer');
create type public.account_status as enum ('active', 'on_hold', 'disabled');
create type public.project_status as enum ('done', 'wip');
create type public.document_kind as enum ('file', 'link');

-- Emails that become super admins on first sign in (seeded by the operator, see DEPLOYMENT.md).
create table public.admin_allowlist (
  email text primary key check (email = lower(email))
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role public.app_role not null default 'editor',
  status public.account_status not null default 'active',
  status_changed_at timestamptz not null default now(),
  terms_accepted_at timestamptz,
  full_name text not null default '' check (char_length(full_name) <= 80),
  headline text not null default '' check (char_length(headline) <= 120),
  org text not null default '' check (char_length(org) <= 120),
  grad_year text not null default '' check (grad_year = '' or grad_year ~ '^[0-9]{4}$'),
  location text not null default '' check (char_length(location) <= 80),
  about text not null default '' check (char_length(about) <= 160),
  linkedin text not null default '' check (char_length(linkedin) <= 200),
  github text not null default '' check (char_length(github) <= 200),
  website text not null default '' check (char_length(website) <= 200),
  slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 64),
  wallpaper text not null default 'oak' check (wallpaper in (
    'oak', 'deco', 'rosefloral', 'silk', 'terra', 'linen', 'mesh', 'ripple',
    'terrazzo', 'bauhaus', 'dunes', 'midnight', 'forest', 'contours', 'charcoal')),
  table_style text not null default 'ledger' check (table_style in (
    'ledger', 'stripe', 'spot', 'lead', 'float', 'frame', 'index', 'blueprint')),
  ink text not null default '#141414' check (ink ~ '^#[0-9a-f]{6}$'),
  glass text not null default '#ffffff' check (glass ~ '^#[0-9a-f]{6}$'),
  line text not null default '#8a8a8a' check (line ~ '^#[0-9a-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  timeline text not null default '' check (char_length(timeline) <= 60),
  description text not null default '' check (char_length(description) <= 2000),
  status public.project_status not null default 'wip',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);
create index projects_owner_idx on public.projects (owner_id, created_at);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  owner_id uuid not null,
  kind public.document_kind not null,
  name text not null check (char_length(name) between 1 and 200),
  url text check (url ~ '^https?://[^\s]+$' and char_length(url) <= 2000),
  object_key text unique,
  mime text,
  size_bytes bigint check (size_bytes >= 0),
  ready boolean not null default false,
  created_at timestamptz not null default now(),
  -- the document's owner is always the project's owner
  foreign key (project_id, owner_id) references public.projects (id, owner_id) on delete cascade,
  check (
    (kind = 'link' and url is not null and object_key is null)
    or (kind = 'file' and object_key is not null and url is null and mime is not null)
  )
);
create index documents_project_idx on public.documents (project_id, created_at);
create index documents_owner_idx on public.documents (owner_id);

create table public.page_visits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  visitor_key text not null check (visitor_key ~ '^[A-Za-z0-9_-]{16,64}$'),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index page_visits_owner_idx on public.page_visits (owner_id, started_at);
create index page_visits_started_idx on public.page_visits (started_at);

create table public.file_opens (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.documents (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  visitor_key text,
  opened_at timestamptz not null default now()
);
create index file_opens_owner_idx on public.file_opens (owner_id, opened_at);
create index file_opens_document_idx on public.file_opens (document_id);
create index file_opens_opened_idx on public.file_opens (opened_at);

create table public.edit_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index edit_sessions_user_idx on public.edit_sessions (user_id, started_at);
create index edit_sessions_started_idx on public.edit_sessions (started_at);
create index edit_sessions_seen_idx on public.edit_sessions (last_seen_at);

-- Feed for the admin "Happening now" rail (Realtime) and sky pulses.
create table public.activity (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('edit', 'upload', 'link', 'visit', 'file_open', 'signup', 'style')),
  user_id uuid not null references public.profiles (id) on delete cascade,
  detail text not null default '',
  at timestamptz not null default now()
);
create index activity_at_idx on public.activity (at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text not null,
  text text not null,
  at timestamptz not null default now()
);
create index audit_log_at_idx on public.audit_log (at desc);
