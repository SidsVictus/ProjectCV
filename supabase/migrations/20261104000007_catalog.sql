-- Catalogue of wallpapers, table styles and colour swatches, managed by super admins.
-- Built-ins are seeded here (their designs live in the site's CSS); custom ones are added from the
-- dashboard: wallpapers are uploaded images in R2, tables are a built-in design with their own colours.
-- Items are hidden, never deleted, so a portfolio that already uses one keeps working.

create table public.catalog (
  kind text not null check (kind in ('wallpaper', 'table', 'ink', 'glass', 'line')),
  id text not null check (id ~ '^[a-z0-9#-]{1,40}$'),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  builtin boolean not null default false,
  hidden boolean not null default false,
  ready boolean not null default true,          -- false while a wallpaper upload is in flight
  sort int not null default 0,
  -- custom wallpaper image
  object_key text check (object_key ~ '^wallpapers/[a-z0-9-]+\.(jpg|png|webp)$'),
  mime text check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint check (size_bytes between 1 and 8388608),
  -- custom table: a built-in design plus three colours
  base text,
  header text check (header ~ '^#[0-9a-f]{6}$'),
  rule text check (rule ~ '^#[0-9a-f]{6}$'),
  band text check (band ~ '^#[0-9a-f]{6}$'),
  -- colour swatch
  hex text check (hex ~ '^#[0-9a-f]{6}$'),
  created_at timestamptz not null default now(),
  primary key (kind, id),
  check (kind <> 'wallpaper' or builtin or (object_key is not null and mime is not null and size_bytes is not null)),
  check (kind <> 'table' or builtin or (base is not null and header is not null and rule is not null and band is not null)),
  check (kind not in ('ink', 'glass', 'line') or (hex is not null and id = hex))
);

insert into public.catalog (kind, id, name, builtin, sort)
select 'wallpaper', id, name, true, ord from unnest(
  array['oak', 'deco', 'rosefloral', 'silk', 'terra', 'linen', 'mesh', 'ripple', 'terrazzo', 'bauhaus', 'dunes', 'midnight', 'forest', 'contours', 'charcoal'],
  array['Oak grain', 'Art deco', 'Rose gold vines', 'Champagne silk', 'Terracotta sun', 'Sage linen', 'Rose quartz', 'Lilac ripple', 'Terrazzo', 'Bauhaus', 'Dusk dunes', 'Midnight silk', 'Deep forest', 'Ink contours', 'Graphite']
) with ordinality as t(id, name, ord);

insert into public.catalog (kind, id, name, builtin, sort)
select 'table', id, name, true, ord from unnest(
  array['ledger', 'stripe', 'spot', 'lead', 'float', 'frame', 'index', 'blueprint'],
  array['Ledger', 'Silk stripe', 'Spotlight', 'Lead column', 'Float', 'Frame', 'Index', 'Blueprint']
) with ordinality as t(id, name, ord);

insert into public.catalog (kind, id, name, hex, builtin, sort)
select 'ink', hex, name, hex, true, ord from unnest(
  array['#141414', '#3a3a3a', '#ffffff', '#f4ecdc', '#1d2a44', '#1f3a2b', '#4a1f27', '#4a3426'],
  array['Ink black', 'Charcoal', 'Pure white', 'Ivory', 'Midnight', 'Forest', 'Burgundy', 'Cocoa']
) with ordinality as t(hex, name, ord);

insert into public.catalog (kind, id, name, hex, builtin, sort)
select 'glass', hex, name, hex, true, ord from unnest(
  array['#ffffff', '#1a1a1a', '#e9dcc4', '#f1d4d4', '#d3e2cf', '#d3e1f0', '#e1d8f0', '#0b0b14'],
  array['Clear white', 'Smoke', 'Sand', 'Rose', 'Sage', 'Sky', 'Lilac', 'Night']
) with ordinality as t(hex, name, ord);

insert into public.catalog (kind, id, name, hex, builtin, sort)
select 'line', hex, name, hex, true, ord from unnest(
  array['#8a8a8a', '#d2d2d2', '#3a3a3a', '#ffffff', '#b8955a', '#7d9278', '#b98a8a', '#4f6083'],
  array['Soft grey', 'Pale grey', 'Graphite', 'White', 'Brass', 'Sage', 'Dusty rose', 'Slate blue']
) with ordinality as t(hex, name, ord);

alter table public.catalog add constraint catalog_table_base_builtin
  check (base is null or base in ('ledger', 'stripe', 'spot', 'lead', 'float', 'frame', 'index', 'blueprint'));

-- Everyone can read finished items: public pages need custom wallpapers and tables.
alter table public.catalog enable row level security;
revoke all on public.catalog from anon, authenticated;
grant select on public.catalog to anon, authenticated;
create policy catalog_read_public on public.catalog for select to anon using (ready);
-- signed in: the same, and super admins also see their uploads in flight
create policy catalog_read on public.catalog for select to authenticated using (ready or (select public.is_super_admin()));

-- A portfolio may only switch to a wallpaper or table that exists and is not hidden.
-- Keeping a now-hidden one, and the defaults on a new account, are always allowed.
alter table public.profiles drop constraint if exists profiles_wallpaper_check;
alter table public.profiles drop constraint if exists profiles_table_style_check;

create function public.check_profile_style() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.wallpaper is distinct from old.wallpaper and not exists (
    select 1 from public.catalog where kind = 'wallpaper' and id = new.wallpaper and ready and not hidden) then
    raise exception 'unknown wallpaper' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.table_style is distinct from old.table_style and not exists (
    select 1 from public.catalog where kind = 'table' and id = new.table_style and ready and not hidden) then
    raise exception 'unknown table style' using errcode = '23514';
  end if;
  return new;
end; $$;

create trigger profiles_style_check before update of wallpaper, table_style on public.profiles
  for each row execute function public.check_profile_style();

-- ---------- super admin changes (each one is written to audit_log) ----------

create function public.catalog_kind_label(p_kind text) returns text
language sql immutable set search_path = '' as $$
  select case p_kind when 'wallpaper' then 'wallpaper' when 'table' then 'table style'
    when 'ink' then 'text colour' when 'glass' then 'glass colour' else 'line colour' end;
$$;

create function public.catalog_next_sort(p_kind text) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(max(sort), 0) + 1 from public.catalog where kind = p_kind;
$$;

-- Step 1 of a wallpaper upload: reserves the item and its storage key. Step 2 is admin_catalog_ready.
create function public.admin_catalog_start_wallpaper(p_name text, p_mime text, p_size bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := public.require_super_admin();
  new_id text := 'w-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  ext text := case p_mime when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' end;
  key text;
begin
  if ext is null then raise exception 'unsupported image type' using errcode = '22023'; end if;
  key := 'wallpapers/' || new_id || '.' || ext;
  insert into public.catalog (kind, id, name, ready, sort, object_key, mime, size_bytes)
  values ('wallpaper', new_id, btrim(p_name), false, public.catalog_next_sort('wallpaper'), key, p_mime, p_size);
  return jsonb_build_object('id', new_id, 'object_key', key);
end; $$;

create function public.admin_catalog_ready(p_id text, p_size bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles := public.require_super_admin(); item public.catalog;
begin
  update public.catalog set ready = true
  where kind = 'wallpaper' and id = p_id and not ready and size_bytes = p_size
  returning * into item;
  if item.id is null then raise exception 'upload not found' using errcode = 'P0002'; end if;
  insert into public.audit_log (actor_id, actor_name, text) values (me.id, public.display_name(me),
    'added the wallpaper ' || item.name);
end; $$;

-- Removes an upload that did not finish.
create function public.admin_catalog_abort(p_id text) returns text
language plpgsql security definer set search_path = '' as $$
declare me public.profiles := public.require_super_admin(); key text;
begin
  delete from public.catalog where kind = 'wallpaper' and id = p_id and not ready returning object_key into key;
  return key;
end; $$;

create function public.admin_catalog_add_table(p_name text, p_base text, p_header text, p_rule text, p_band text) returns text
language plpgsql security definer set search_path = '' as $$
declare me public.profiles := public.require_super_admin(); new_id text := 't-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
begin
  insert into public.catalog (kind, id, name, sort, base, header, rule, band)
  values ('table', new_id, btrim(p_name), public.catalog_next_sort('table'), p_base, lower(p_header), lower(p_rule), lower(p_band));
  insert into public.audit_log (actor_id, actor_name, text) values (me.id, public.display_name(me),
    'added the table style ' || btrim(p_name));
  return new_id;
end; $$;

-- A colour swatch is identified by its hex. Adding one that exists (even hidden) shows it again under the new name.
create function public.admin_catalog_add_colour(p_kind text, p_name text, p_hex text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles := public.require_super_admin();
begin
  if p_kind not in ('ink', 'glass', 'line') then raise exception 'not a colour' using errcode = '22023'; end if;
  insert into public.catalog (kind, id, name, hex, sort)
  values (p_kind, lower(p_hex), btrim(p_name), lower(p_hex), public.catalog_next_sort(p_kind))
  on conflict (kind, id) do update set name = excluded.name, hidden = false;
  insert into public.audit_log (actor_id, actor_name, text) values (me.id, public.display_name(me),
    'added the ' || public.catalog_kind_label(p_kind) || ' ' || btrim(p_name));
end; $$;

create function public.admin_catalog_set_hidden(p_kind text, p_id text, p_hidden boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles := public.require_super_admin(); item public.catalog;
begin
  update public.catalog set hidden = p_hidden where kind = p_kind and id = p_id and ready and hidden <> p_hidden
  returning * into item;
  if item.id is null then return; end if;
  if p_hidden and not exists (select 1 from public.catalog where kind = p_kind and ready and not hidden) then
    raise exception 'keep at least one' using errcode = '23514';
  end if;
  insert into public.audit_log (actor_id, actor_name, text) values (me.id, public.display_name(me),
    case when p_hidden then 'hid the ' else 'showed the ' end || public.catalog_kind_label(p_kind) || ' ' || item.name);
end; $$;

revoke execute on function public.check_profile_style(), public.catalog_kind_label(text), public.catalog_next_sort(text)
  from public, anon, authenticated;
revoke execute on function public.admin_catalog_start_wallpaper(text, text, bigint), public.admin_catalog_ready(text, bigint),
  public.admin_catalog_abort(text), public.admin_catalog_add_table(text, text, text, text, text),
  public.admin_catalog_add_colour(text, text, text), public.admin_catalog_set_hidden(text, text, boolean) from public, anon;
grant execute on function public.admin_catalog_start_wallpaper(text, text, bigint), public.admin_catalog_ready(text, bigint),
  public.admin_catalog_abort(text), public.admin_catalog_add_table(text, text, text, text, text),
  public.admin_catalog_add_colour(text, text, text), public.admin_catalog_set_hidden(text, text, boolean) to authenticated;
