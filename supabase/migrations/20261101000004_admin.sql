-- Super admin: analytics snapshot, account and role changes, delete, invites, live count.
-- Every function checks is_super_admin() itself; every change writes audit_log in the same transaction.

create function public.require_super_admin() returns public.profiles
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid() and role = 'super_admin' and status = 'active';
  if me.id is null then raise exception 'super admin only' using errcode = '42501'; end if;
  return me;
end; $$;

create function public.display_name(p public.profiles) returns text
language sql immutable set search_path = '' as $$
  select coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1));
$$;

-- Share of users who signed up between from_day and to_day days ago (and are at least n days old)
-- with an editing session that started between day 1 and day n after signup.
create function public.retention_share(from_day int, to_day int, n int) returns int
language sql stable security definer set search_path = '' as $$
  with today as (select (now() at time zone 'Asia/Kolkata')::date as d),
  elig as (
    select p.id, (p.created_at at time zone 'Asia/Kolkata')::date as joined
    from public.profiles p, today
    where (p.created_at at time zone 'Asia/Kolkata')::date between today.d - to_day and today.d - greatest(from_day, n)
  )
  select coalesce(round(100.0 * count(*) filter (where exists (
    select 1 from public.edit_sessions s where s.user_id = elig.id
      and (s.started_at at time zone 'Asia/Kolkata')::date between elig.joined + 1 and elig.joined + n
  )) / nullif(count(*), 0)), 0)::int from elig;
$$;

create function public.admin_snapshot() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := public.require_super_admin();
  today date := (now() at time zone 'Asia/Kolkata')::date;
  ist constant text := 'Asia/Kolkata';
begin
  return jsonb_build_object(
    'me', public.display_name(me),
    'me_id', me.id,
    'now', now(),
    'live_now', (select count(distinct user_id) from public.edit_sessions where last_seen_at > now() - interval '2 minutes'),
    'users', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', public.display_name(p), 'email', p.email, 'org', btrim(p.org), 'slug', p.slug,
        'role', p.role, 'status', p.status,
        'status_days', today - (p.status_changed_at at time zone ist)::date,
        'signup_day', today - (p.created_at at time zone ist)::date,
        'last_active_day', greatest(0, today - (p.last_active_at at time zone ist)::date),
        'wallpaper', p.wallpaper, 'table_style', p.table_style, 'ink', p.ink, 'glass', p.glass,
        'projects', (select count(*) from public.projects x where x.owner_id = p.id),
        'documents', (select count(*) from public.documents x where x.owner_id = p.id and x.kind = 'file' and x.ready),
        'links', (select count(*) from public.documents x where x.owner_id = p.id and x.kind = 'link'),
        'visitors', (select count(distinct visitor_key) from public.page_visits x where x.owner_id = p.id),
        'avg_view_sec', (select coalesce(round(avg(extract(epoch from x.last_seen_at - x.started_at))), 0) from public.page_visits x where x.owner_id = p.id),
        'files_opened', (select count(*) from public.file_opens x where x.owner_id = p.id),
        -- exact per-range counts for the leaderboard (7, 30, 90 days)
        'visitors_r', jsonb_build_object(
          '7', (select count(distinct visitor_key) from public.page_visits x where x.owner_id = p.id and x.started_at > now() - interval '7 days'),
          '30', (select count(distinct visitor_key) from public.page_visits x where x.owner_id = p.id and x.started_at > now() - interval '30 days'),
          '90', (select count(distinct visitor_key) from public.page_visits x where x.owner_id = p.id and x.started_at > now() - interval '90 days')),
        'files_r', jsonb_build_object(
          '7', (select count(*) from public.file_opens x where x.owner_id = p.id and x.opened_at > now() - interval '7 days'),
          '30', (select count(*) from public.file_opens x where x.owner_id = p.id and x.opened_at > now() - interval '30 days'),
          '90', (select count(*) from public.file_opens x where x.owner_id = p.id and x.opened_at > now() - interval '90 days')),
        'edit_min', (select coalesce(round(avg(extract(epoch from x.last_seen_at - x.started_at)) / 60, 1), 0) from public.edit_sessions x where x.user_id = p.id),
        'sessions', (select count(*) from public.edit_sessions x where x.user_id = p.id)
      ) order by p.created_at) from public.profiles p), '[]'::jsonb),
    -- 365 values each, index 0 = today (IST)
    'daily', jsonb_build_object(
      'signups', (select jsonb_agg(coalesce(x.n, 0) order by g.d) from generate_series(0, 364) g(d) left join
        (select today - (created_at at time zone ist)::date d, count(*) n from public.profiles group by 1) x on x.d = g.d),
      'page_views', (select jsonb_agg(coalesce(x.n, 0) order by g.d) from generate_series(0, 364) g(d) left join
        (select today - (started_at at time zone ist)::date d, count(*) n from public.page_visits group by 1) x on x.d = g.d),
      'visitors', (select jsonb_agg(coalesce(x.n, 0) order by g.d) from generate_series(0, 364) g(d) left join
        (select today - (started_at at time zone ist)::date d, count(distinct visitor_key) n from public.page_visits group by 1) x on x.d = g.d),
      'active_editors', (select jsonb_agg(coalesce(x.n, 0) order by g.d) from generate_series(0, 364) g(d) left join
        (select today - (started_at at time zone ist)::date d, count(distinct user_id) n from public.edit_sessions group by 1) x on x.d = g.d),
      'projects_added', (select jsonb_agg(coalesce(x.n, 0) order by g.d) from generate_series(0, 364) g(d) left join
        (select today - (created_at at time zone ist)::date d, count(*) n from public.projects group by 1) x on x.d = g.d),
      'docs_uploaded', (select jsonb_agg(coalesce(x.n, 0) order by g.d) from generate_series(0, 364) g(d) left join
        (select today - (created_at at time zone ist)::date d, count(*) n from public.documents where kind = 'file' and ready group by 1) x on x.d = g.d),
      'links_attached', (select jsonb_agg(coalesce(x.n, 0) order by g.d) from generate_series(0, 364) g(d) left join
        (select today - (created_at at time zone ist)::date d, count(*) n from public.documents where kind = 'link' group by 1) x on x.d = g.d),
      -- tenths of a minute, mean per session started that day
      'edit_minutes', (select jsonb_agg(coalesce(x.n, 0) order by g.d) from generate_series(0, 364) g(d) left join
        (select today - (started_at at time zone ist)::date d, round(avg(extract(epoch from last_seen_at - started_at)) / 6) n from public.edit_sessions group by 1) x on x.d = g.d),
      'files_opened', (select jsonb_agg(coalesce(x.n, 0) order by g.d) from generate_series(0, 364) g(d) left join
        (select today - (opened_at at time zone ist)::date d, count(*) n from public.file_opens group by 1) x on x.d = g.d),
      'view_seconds', (select jsonb_agg(coalesce(x.n, 0) order by g.d) from generate_series(0, 364) g(d) left join
        (select today - (started_at at time zone ist)::date d, round(avg(extract(epoch from last_seen_at - started_at))) n from public.page_visits group by 1) x on x.d = g.d)
    ),
    -- 12 weekly cohorts, oldest first; values[w] = % of the cohort with a session in week w after signup
    'cohorts', (select jsonb_agg(jsonb_build_object('start', c.start, 'size', c.size, 'values', c.vals) order by c.idx)
      from (
        select k.idx, k.start, (select count(*) from public.profiles p
            where (p.created_at at time zone ist)::date between k.start and k.start + 6) size,
          (select jsonb_agg(case
              when w > 11 - k.idx then null
              -- a week with no signups has no columns (not 0%)
              when not exists (select 1 from public.profiles p
                where (p.created_at at time zone ist)::date between k.start and k.start + 6) then null
              when w = 0 then 100
              else (select coalesce(round(100.0 * count(*) filter (where exists (
                  select 1 from public.edit_sessions s where s.user_id = p.id
                    and (s.started_at at time zone ist)::date between (p.created_at at time zone ist)::date + w * 7
                                                                and (p.created_at at time zone ist)::date + w * 7 + 6))
                / nullif(count(*), 0)), 0)
                from public.profiles p where (p.created_at at time zone ist)::date between k.start and k.start + 6)
            end order by w) from generate_series(0, 11) w) vals
        from (select i idx, today - (11 - i) * 7 - 6 start from generate_series(0, 11) i) k
      ) c),
    'retention', jsonb_build_object(
      'd1', public.retention_share(0, 90, 1), 'd7', public.retention_share(0, 90, 7), 'd30', public.retention_share(0, 90, 30),
      'prev', jsonb_build_object('d1', public.retention_share(91, 180, 1), 'd7', public.retention_share(91, 180, 7), 'd30', public.retention_share(91, 180, 30))),
    -- [7][24] sessions started in the last 90 days, Monday first, IST hours
    'heat', (select jsonb_agg((select jsonb_agg((select count(*) from public.edit_sessions s
          where s.started_at > now() - interval '90 days'
            and extract(isodow from s.started_at at time zone ist) = wd + 1
            and extract(hour from s.started_at at time zone ist) = h) order by h)
        from generate_series(0, 23) h) order by wd) from generate_series(0, 6) wd),
    -- most opened documents, with exact opens per range ('all', '7', '30', '90')
    'files', coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'opens', jsonb_build_object(
        'all', t.n, '7', t.n7, '30', t.n30, '90', t.n90)) order by t.n desc)
      from (select d.name, count(*) n,
              count(*) filter (where f.opened_at > now() - interval '7 days') n7,
              count(*) filter (where f.opened_at > now() - interval '30 days') n30,
              count(*) filter (where f.opened_at > now() - interval '90 days') n90
            from public.file_opens f join public.documents d on d.id = f.document_id
            group by d.id, d.name order by count(*) desc limit 50) t), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(jsonb_build_object('who', a.actor_name, 'text', a.text,
        'minutes', floor(extract(epoch from now() - a.at) / 60)) order by a.at desc)
      from (select * from public.audit_log order by at desc limit 20) a), '[]'::jsonb),
    'feed', coalesce((select jsonb_agg(jsonb_build_object('kind', a.kind, 'user_id', a.user_id, 'detail', a.detail, 'at', a.at) order by a.at desc)
      from (select * from public.activity order by at desc limit 9) a), '[]'::jsonb)
  );
end; $$;

create function public.admin_live_now() returns int
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_super_admin();
  return (select count(distinct user_id) from public.edit_sessions where last_seen_at > now() - interval '2 minutes');
end; $$;

create function public.role_label(r public.app_role) returns text
language sql immutable set search_path = '' as $$
  select case r when 'super_admin' then 'Super admin' when 'editor' then 'Editor' else 'Viewer' end;
$$;

-- BR-1: never on yourself. (BR-2 follows: the caller is an active super admin who stays one.)
create function public.admin_target(p_user uuid) returns public.profiles
language plpgsql stable security definer set search_path = '' as $$
declare t public.profiles;
begin
  if p_user = auth.uid() then raise exception 'You cannot change your own account here.' using errcode = '42501'; end if;
  select * into t from public.profiles where id = p_user;
  if t.id is null then raise exception 'account not found' using errcode = 'P0002'; end if;
  return t;
end; $$;

create function public.admin_set_status(p_user uuid, p_status public.account_status) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles := public.require_super_admin(); t public.profiles := public.admin_target(p_user);
begin
  if t.status = p_status then return; end if;
  update public.profiles set status = p_status, status_changed_at = now() where id = p_user;
  insert into public.audit_log (actor_id, actor_name, text) values (me.id, public.display_name(me),
    case p_status when 'on_hold' then 'put ' || public.display_name(t) || ' on hold'
                  when 'disabled' then 'disabled ' || public.display_name(t)
                  else 'activated ' || public.display_name(t) end);
end; $$;

create function public.admin_set_role(p_user uuid, p_role public.app_role) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles := public.require_super_admin(); t public.profiles := public.admin_target(p_user);
begin
  if t.role = p_role then return; end if;
  update public.profiles set role = p_role where id = p_user;
  insert into public.audit_log (actor_id, actor_name, text) values (me.id, public.display_name(me),
    'changed ' || public.display_name(t) || ' from ' || public.role_label(t.role) || ' to ' || public.role_label(p_role));
end; $$;

-- Removes the account, portfolio, projects, documents and share link. Returns the R2 keys to delete.
create function public.admin_delete_account(p_user uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare me public.profiles := public.require_super_admin(); t public.profiles := public.admin_target(p_user); keys text[];
begin
  select coalesce(array_agg(object_key), '{}') into keys from public.documents where owner_id = p_user and object_key is not null;
  insert into public.audit_log (actor_id, actor_name, text) values (me.id, public.display_name(me),
    'deleted ' || public.display_name(t) || '''s account');
  delete from auth.users where id = p_user;
  return keys;
end; $$;

-- Called right after the server creates the auth user for "Add user".
create function public.admin_invited(p_user uuid, p_role public.app_role) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles := public.require_super_admin(); t public.profiles := public.admin_target(p_user);
begin
  if t.created_at < now() - interval '10 minutes' then raise exception 'not a new account' using errcode = '42501'; end if;
  update public.profiles set role = p_role where id = p_user;
  insert into public.audit_log (actor_id, actor_name, text) values (me.id, public.display_name(me),
    'added ' || public.display_name(t) || ' as ' || case p_role when 'editor' then 'an Editor' when 'viewer' then 'a Viewer' else 'a Super admin' end);
end; $$;

create function public.admin_log(p_text text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles := public.require_super_admin();
begin
  insert into public.audit_log (actor_id, actor_name, text) values (me.id, public.display_name(me), left(p_text, 200));
end; $$;

revoke execute on all functions in schema public from public, anon;
revoke execute on function public.require_super_admin(), public.admin_target(uuid), public.retention_share(int, int, int),
  public.display_name(public.profiles), public.role_label(public.app_role) from authenticated;
grant execute on function public.admin_snapshot(), public.admin_live_now(), public.admin_set_status(uuid, public.account_status),
  public.admin_set_role(uuid, public.app_role), public.admin_delete_account(uuid), public.admin_invited(uuid, public.app_role),
  public.admin_log(text) to authenticated;
-- the public functions from the previous migration stay callable by visitors
grant execute on function public.get_public_portfolio(text), public.record_visit(text, text),
  public.touch_visit(uuid, text), public.open_document(uuid, text), public.portfolio_stats(text, text) to anon;

-- Live feed for the admin rail (RLS: super admins only).
alter publication supabase_realtime add table public.activity;
