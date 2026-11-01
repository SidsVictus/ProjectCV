-- Hardening: visit and file-open counting only through the server, with per-IP limits;
-- a storage quota with exact upload sizes.

-- ---------- 1. Counting: server only, rate limited by a one-way IP hash
alter table public.page_visits add column ip_hash text check (ip_hash ~ '^[0-9a-f]{64}$');
alter table public.file_opens add column ip_hash text check (ip_hash ~ '^[0-9a-f]{64}$');
create index page_visits_ip_idx on public.page_visits (ip_hash, started_at);
create index file_opens_ip_idx on public.file_opens (ip_hash, opened_at);

drop function public.record_visit(text, text);
drop function public.touch_visit(uuid, text);
drop function public.open_document(uuid, text);

-- Limits: one network counts at most 3 visits per page per day and 60 visits per hour across all pages.
-- p_viewer is the signed-in viewer (from the server's session check), so owners are never counted.
create function public.record_visit(p_slug text, p_visitor text, p_ip_hash text, p_viewer uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.profiles := public.page_owner(p_slug); v_id uuid;
begin
  if p.id is null or p.status = 'disabled' or p.id = p_viewer then return null; end if;
  if p_visitor !~ '^[A-Za-z0-9_-]{16,64}$' or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad visitor' using errcode = '22023';
  end if;
  select id into v_id from public.page_visits
  where owner_id = p.id and visitor_key = p_visitor and last_seen_at > now() - interval '30 minutes'
  order by started_at desc limit 1;
  if v_id is not null then return v_id; end if;
  if (select count(*) from public.page_visits where owner_id = p.id and ip_hash = p_ip_hash and started_at > now() - interval '1 day') >= 3
     or (select count(*) from public.page_visits where ip_hash = p_ip_hash and started_at > now() - interval '1 hour') >= 60 then
    return null; -- over the limit: the page still opens, the visit is not counted
  end if;
  insert into public.page_visits (owner_id, visitor_key, ip_hash) values (p.id, p_visitor, p_ip_hash) returning id into v_id;
  return v_id;
end; $$;

create function public.touch_visit(p_id uuid, p_visitor text) returns void
language sql security definer set search_path = '' as $$
  update public.page_visits set last_seen_at = least(now(), started_at + interval '30 minutes')
  where id = p_id and visitor_key = p_visitor;
$$;

-- One network counts at most 3 opens of the same document per hour.
create function public.open_document(p_id uuid, p_visitor text, p_ip_hash text, p_viewer uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d public.documents; o public.profiles;
begin
  select * into d from public.documents where id = p_id and ready;
  if d.id is null then return null; end if;
  select * into o from public.profiles where id = d.owner_id;
  if o.status = 'disabled' and o.id is distinct from p_viewer then return null; end if;
  if o.id is distinct from p_viewer and p_ip_hash ~ '^[0-9a-f]{64}$'
     and (select count(*) from public.file_opens where document_id = d.id and ip_hash = p_ip_hash and opened_at > now() - interval '1 hour') < 3 then
    insert into public.file_opens (document_id, owner_id, visitor_key, ip_hash)
    values (d.id, d.owner_id, case when p_visitor ~ '^[A-Za-z0-9_-]{16,64}$' then p_visitor end, p_ip_hash);
  end if;
  return jsonb_build_object('kind', d.kind, 'url', d.url, 'object_key', d.object_key, 'mime', d.mime, 'name', d.name);
end; $$;

revoke execute on function public.record_visit(text, text, text, uuid), public.touch_visit(uuid, text),
  public.open_document(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_visit(text, text, text, uuid), public.touch_visit(uuid, text),
  public.open_document(uuid, text, text, uuid) to service_role;

-- ---------- 2. Storage quota: 100 MB per file, 1 GB per account (ready and pending uploads count)
drop function public.create_file_document(uuid, text, text);
drop function public.mark_document_ready(uuid, bigint);

create function public.create_file_document(p_project uuid, p_name text, p_mime text, p_size bigint) returns public.documents
language plpgsql security definer set search_path = '' as $$
declare v_ext text := public.file_ext(p_mime); v_id uuid := gen_random_uuid(); v_doc public.documents; v_used bigint;
begin
  if not public.is_editor() then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_ext is null then raise exception 'file type not allowed' using errcode = '22023'; end if;
  if p_size is null or p_size < 1 or p_size > 100 * 1024 * 1024 then raise exception 'file too large' using errcode = '22023'; end if;
  if not exists (select 1 from public.projects where id = p_project and owner_id = auth.uid()) then
    raise exception 'project not found' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('quota:' || auth.uid()::text)); -- no race past the quota
  select coalesce(sum(size_bytes), 0) into v_used from public.documents where owner_id = auth.uid() and kind = 'file';
  if v_used + p_size > 1024 * 1024 * 1024 then raise exception 'storage quota reached' using errcode = '53400'; end if;
  insert into public.documents (id, project_id, owner_id, kind, name, object_key, mime, size_bytes, ready)
  values (v_id, p_project, auth.uid(), 'file', left(btrim(p_name), 200),
          'users/' || auth.uid() || '/projects/' || p_project || '/' || v_id || '.' || v_ext, p_mime, p_size, false)
  returning * into v_doc;
  return v_doc;
end; $$;

-- The uploaded object must be exactly the size that was reserved.
create function public.mark_document_ready(p_id uuid, p_size bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_editor() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.documents set ready = true
  where id = p_id and owner_id = auth.uid() and kind = 'file' and not ready and size_bytes = p_size;
  if not found then raise exception 'document not found' using errcode = '42501'; end if;
end; $$;

revoke execute on function public.create_file_document(uuid, text, text, bigint), public.mark_document_ready(uuid, bigint) from public, anon;
grant execute on function public.create_file_document(uuid, text, text, bigint), public.mark_document_ready(uuid, bigint) to authenticated;

