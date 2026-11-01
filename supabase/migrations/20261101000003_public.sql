-- Functions anonymous visitors may call. Each returns public fields only (never email).

-- Page owner behind a slug, or null when there is no published page.
create function public.page_owner(p_slug text) returns public.profiles
language sql stable security definer set search_path = '' as $$
  select p.* from public.profiles p
  where p.slug = p_slug and p.terms_accepted_at is not null and p.role in ('editor', 'super_admin');
$$;

create function public.get_public_portfolio(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles := public.page_owner(p_slug);
begin
  if p.id is null then return null; end if;
  if p.status = 'disabled' then return jsonb_build_object('status', 'unavailable'); end if;
  return jsonb_build_object(
    'status', 'ok',
    'is_owner', p.id = auth.uid(),
    'profile', jsonb_build_object(
      'full_name', p.full_name, 'headline', p.headline, 'org', p.org, 'grad_year', p.grad_year,
      'location', p.location, 'about', p.about, 'linkedin', p.linkedin, 'github', p.github,
      'website', p.website, 'slug', p.slug, 'wallpaper', p.wallpaper, 'table_style', p.table_style,
      'ink', p.ink, 'glass', p.glass, 'line', p.line),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'name', pr.name, 'timeline', pr.timeline, 'description', pr.description,
        'status', pr.status,
        'documents', coalesce((
          select jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'name', d.name) order by d.created_at)
          from public.documents d where d.project_id = pr.id and d.ready), '[]'::jsonb)
      ) order by pr.created_at)
      from public.projects pr where pr.owner_id = p.id), '[]'::jsonb)
  );
end; $$;

-- One visit per visitor per page per 30 minutes. The owner's own visits are not counted (BR-5).
create function public.record_visit(p_slug text, p_visitor text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.profiles := public.page_owner(p_slug); v_id uuid;
begin
  if p.id is null or p.status = 'disabled' or p.id = auth.uid() then return null; end if;
  if p_visitor !~ '^[A-Za-z0-9_-]{16,64}$' then raise exception 'bad visitor key' using errcode = '22023'; end if;
  select id into v_id from public.page_visits
  where owner_id = p.id and visitor_key = p_visitor and last_seen_at > now() - interval '30 minutes'
  order by started_at desc limit 1;
  if v_id is null then
    insert into public.page_visits (owner_id, visitor_key) values (p.id, p_visitor) returning id into v_id;
  end if;
  return v_id;
end; $$;

-- Time on page: the visit's last ping, capped at 30 minutes after it started.
create function public.touch_visit(p_id uuid, p_visitor text) returns void
language sql security definer set search_path = '' as $$
  update public.page_visits set last_seen_at = least(now(), started_at + interval '30 minutes')
  where id = p_id and visitor_key = p_visitor;
$$;

-- Where a document opens, counted unless the owner opens it. Null when it is not viewable.
create function public.open_document(p_id uuid, p_visitor text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d public.documents; o public.profiles;
begin
  select * into d from public.documents where id = p_id and ready;
  if d.id is null then return null; end if;
  select * into o from public.profiles where id = d.owner_id;
  if o.status = 'disabled' and o.id is distinct from auth.uid() then return null; end if;
  if o.id is distinct from auth.uid() then
    insert into public.file_opens (document_id, owner_id, visitor_key)
    values (d.id, d.owner_id, case when p_visitor ~ '^[A-Za-z0-9_-]{16,64}$' then p_visitor end);
  end if;
  return jsonb_build_object('kind', d.kind, 'url', d.url, 'object_key', d.object_key, 'mime', d.mime, 'name', d.name);
end; $$;

-- "Who saw your page": visitors, average time, files opened, visits per bucket, most opened files.
create function public.portfolio_stats(p_slug text, p_range text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  p public.profiles := public.page_owner(p_slug);
  today date := (now() at time zone 'Asia/Kolkata')::date;
  v_from date; v_buckets jsonb; v_months int;
begin
  if p.id is null or p.status = 'disabled' then return null; end if;
  if p_range = '7d' then
    v_from := today - 6;
    select jsonb_agg(jsonb_build_array(to_char(g.d, 'Dy'), (
      select count(distinct visitor_key) from public.page_visits v
      where v.owner_id = p.id and (v.started_at at time zone 'Asia/Kolkata')::date = g.d::date)) order by g.d)
    into v_buckets from generate_series(v_from::timestamp, today::timestamp, interval '1 day') g(d);
  elsif p_range = '30d' then
    v_from := today - 27;
    select jsonb_agg(jsonb_build_array('Week ' || (w + 1), (
      select count(distinct visitor_key) from public.page_visits v
      where v.owner_id = p.id and (v.started_at at time zone 'Asia/Kolkata')::date between v_from + w * 7 and v_from + w * 7 + 6)) order by w)
    into v_buckets from generate_series(0, 3) w;
  elsif p_range = 'all' then
    v_months := least(11, (extract(year from age(date_trunc('month', today), date_trunc('month', (p.created_at at time zone 'Asia/Kolkata')::date))) * 12
      + extract(month from age(date_trunc('month', today), date_trunc('month', (p.created_at at time zone 'Asia/Kolkata')::date))))::int);
    v_from := (date_trunc('month', today) - make_interval(months => v_months))::date;
    select jsonb_agg(jsonb_build_array(to_char(m, 'Mon'), (
      select count(distinct visitor_key) from public.page_visits v
      where v.owner_id = p.id and date_trunc('month', v.started_at at time zone 'Asia/Kolkata') = m)) order by m)
    into v_buckets from generate_series(v_from::timestamp, date_trunc('month', today)::timestamp, interval '1 month') m;
    v_from := '-infinity'::date;
  else
    raise exception 'bad range' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'visitors', (select count(distinct visitor_key) from public.page_visits
                 where owner_id = p.id and (started_at at time zone 'Asia/Kolkata')::date >= v_from),
    'avg_seconds', (select coalesce(round(avg(extract(epoch from last_seen_at - started_at))), 0)::int
                    from public.page_visits where owner_id = p.id and (started_at at time zone 'Asia/Kolkata')::date >= v_from),
    'files_opened', (select count(*) from public.file_opens
                     where owner_id = p.id and (opened_at at time zone 'Asia/Kolkata')::date >= v_from),
    'buckets', coalesce(v_buckets, '[]'::jsonb),
    'files', coalesce((
      select jsonb_agg(jsonb_build_array(name, n) order by n desc, name)
      from (select d.name, count(*) as n from public.file_opens f join public.documents d on d.id = f.document_id
            where f.owner_id = p.id and (f.opened_at at time zone 'Asia/Kolkata')::date >= v_from
            group by d.id, d.name order by n desc, d.name limit 5) t), '[]'::jsonb)
  );
end; $$;

revoke execute on function public.page_owner(text) from public, anon, authenticated;
grant execute on function public.get_public_portfolio(text), public.record_visit(text, text),
  public.touch_visit(uuid, text), public.open_document(uuid, text), public.portfolio_stats(text, text)
  to anon, authenticated;
