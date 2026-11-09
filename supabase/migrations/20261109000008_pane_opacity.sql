-- The glass pane's opacity is the owner's own choice (a slider), the same for every colour, instead of being
-- worked out from the text and glass colours. 0.80 is the standard until they move it.
alter table public.profiles add column pane numeric(3, 2) not null default 0.80 check (pane between 0.30 and 1.00);
grant update (pane) on public.profiles to authenticated;

create or replace function public.get_public_portfolio(p_slug text) returns jsonb
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
      'ink', p.ink, 'glass', p.glass, 'line', p.line, 'pane', p.pane),
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
