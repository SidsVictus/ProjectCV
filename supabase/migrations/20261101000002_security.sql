-- Helpers, signup trigger, row level security, column privileges and owner functions.

-- ---------- role helpers (security definer so policies can read profiles without recursion)
create function public.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin' and status = 'active');
$$;

-- Active editor or super admin who accepted the terms: allowed to build a page.
create function public.is_editor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
    where id = auth.uid() and status = 'active' and role in ('editor', 'super_admin')
      and terms_accepted_at is not null);
$$;

-- ---------- updated_at
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();

-- ---------- new auth user -> profile
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(coalesce(new.email, ''));
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id, v_email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 80),
    case when exists (select 1 from public.admin_allowlist a where a.email = v_email)
      then 'super_admin'::public.app_role else 'editor'::public.app_role end
  );
  insert into public.activity (kind, user_id, detail) values ('signup', new.id, '');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- slug: created once, from the name, the first time a name is saved (BR-4)
create function public.assign_slug() returns trigger
language plpgsql security definer set search_path = '' as $$
declare base text; candidate text; n int := 1;
begin
  if new.slug is not null or btrim(new.full_name) = '' then return new; end if;
  base := left(trim(both '-' from regexp_replace(lower(new.full_name), '[^a-z0-9]+', '-', 'g')), 48);
  if base = '' then base := 'portfolio'; end if;
  candidate := base;
  while exists (select 1 from public.profiles p where p.slug = candidate and p.id <> new.id) loop
    n := n + 1; candidate := base || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end; $$;
create trigger profiles_slug before insert or update of full_name on public.profiles
  for each row execute function public.assign_slug();

-- ---------- activity feed triggers
create function public.log_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'projects' then
    insert into public.activity (kind, user_id, detail) values ('edit', new.owner_id, new.name);
  elsif tg_table_name = 'documents' then
    if new.kind = 'link' and tg_op = 'INSERT' then
      insert into public.activity (kind, user_id, detail) values ('link', new.owner_id, new.name);
    elsif new.kind = 'file' and new.ready and (tg_op = 'INSERT' or not old.ready) then
      insert into public.activity (kind, user_id, detail) values ('upload', new.owner_id, new.name);
    end if;
  elsif tg_table_name = 'page_visits' then
    insert into public.activity (kind, user_id, detail) values ('visit', new.owner_id, '');
  elsif tg_table_name = 'file_opens' then
    insert into public.activity (kind, user_id, detail) values ('file_open', new.owner_id, '');
  elsif tg_table_name = 'profiles' then
    insert into public.activity (kind, user_id, detail) values ('style', new.id, new.wallpaper);
  end if;
  return new;
end; $$;
create trigger projects_activity after insert on public.projects for each row execute function public.log_activity();
create trigger documents_activity after insert or update of ready on public.documents for each row execute function public.log_activity();
create trigger visits_activity after insert on public.page_visits for each row execute function public.log_activity();
create trigger opens_activity after insert on public.file_opens for each row execute function public.log_activity();
create trigger profiles_activity after update of wallpaper on public.profiles for each row
  when (old.wallpaper is distinct from new.wallpaper) execute function public.log_activity();

-- ---------- row level security (fail closed: no policy, no access)
alter table public.admin_allowlist enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.documents enable row level security;
alter table public.page_visits enable row level security;
alter table public.file_opens enable row level security;
alter table public.edit_sessions enable row level security;
alter table public.activity enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_super_admin()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select public.is_editor()))
  with check (id = (select auth.uid()));

create policy projects_select on public.projects for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_super_admin()));
create policy projects_insert on public.projects for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select public.is_editor()));
create policy projects_update on public.projects for update to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_editor()))
  with check (owner_id = (select auth.uid()));
create policy projects_delete on public.projects for delete to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_editor()));

create policy documents_select on public.documents for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_super_admin()));
-- Links only; files are created by create_file_document() so the storage key is never client chosen.
create policy documents_insert_link on public.documents for insert to authenticated
  with check (owner_id = (select auth.uid()) and kind = 'link' and (select public.is_editor()));
create policy documents_delete on public.documents for delete to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_editor()));

create policy activity_select on public.activity for select to authenticated
  using ((select public.is_super_admin()));
create policy audit_select on public.audit_log for select to authenticated
  using ((select public.is_super_admin()));
-- page_visits, file_opens, edit_sessions, admin_allowlist: no policies; reached only through functions.

-- ---------- privileges: owners may change page fields only, never role, status, email, slug or terms
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.projects, public.documents, public.activity, public.audit_log to authenticated;
grant update (full_name, headline, org, grad_year, location, about, linkedin, github, website,
  wallpaper, table_style, ink, glass, line) on public.profiles to authenticated;
grant insert (owner_id, name, timeline, description, status) on public.projects to authenticated;
grant update (name, timeline, description, status) on public.projects to authenticated;
grant delete on public.projects to authenticated;
grant insert (project_id, owner_id, kind, name, url, ready) on public.documents to authenticated;
grant delete on public.documents to authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------- owner functions
create function public.accept_terms() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set terms_accepted_at = now()
  where id = auth.uid() and status = 'active' and terms_accepted_at is null;
$$;

create function public.file_ext(p_mime text) returns text
language sql immutable set search_path = '' as $$
  select case p_mime
    when 'application/pdf' then 'pdf'
    when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' when 'image/gif' then 'gif'
    when 'application/vnd.ms-powerpoint' then 'ppt'
    when 'application/vnd.openxmlformats-officedocument.presentationml.presentation' then 'pptx'
    when 'application/msword' then 'doc'
    when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then 'docx'
    when 'video/mp4' then 'mp4' when 'video/webm' then 'webm' when 'video/quicktime' then 'mov'
    when 'application/zip' then 'zip'
  end;
$$;

-- A pending file document; the server confirms it with mark_document_ready() after checking R2.
create function public.create_file_document(p_project uuid, p_name text, p_mime text) returns public.documents
language plpgsql security definer set search_path = '' as $$
declare v_ext text := public.file_ext(p_mime); v_id uuid := gen_random_uuid(); v_doc public.documents;
begin
  if not public.is_editor() then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_ext is null then raise exception 'file type not allowed' using errcode = '22023'; end if;
  if not exists (select 1 from public.projects where id = p_project and owner_id = auth.uid()) then
    raise exception 'project not found' using errcode = '42501';
  end if;
  insert into public.documents (id, project_id, owner_id, kind, name, object_key, mime, ready)
  values (v_id, p_project, auth.uid(), 'file', left(btrim(p_name), 200),
          'users/' || auth.uid() || '/projects/' || p_project || '/' || v_id || '.' || v_ext, p_mime, false)
  returning * into v_doc;
  return v_doc;
end; $$;

create function public.mark_document_ready(p_id uuid, p_size bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_editor() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.documents set ready = true, size_bytes = p_size
  where id = p_id and owner_id = auth.uid() and kind = 'file' and not ready;
  if not found then raise exception 'document not found' using errcode = '42501'; end if;
end; $$;

-- Editing heartbeat: continues a session seen in the last 5 minutes, otherwise starts one.
create function public.heartbeat_edit_session(p_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_editor() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.edit_sessions set last_seen_at = now()
  where id = p_id and user_id = auth.uid() and last_seen_at > now() - interval '5 minutes'
  returning id into v_id;
  if v_id is null then
    insert into public.edit_sessions (user_id) values (auth.uid()) returning id into v_id;
  end if;
  update public.profiles set last_active_at = now() where id = auth.uid();
  return v_id;
end; $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_super_admin(), public.is_editor(), public.accept_terms(),
  public.create_file_document(uuid, text, text), public.mark_document_ready(uuid, bigint),
  public.heartbeat_edit_session(uuid) to authenticated;
