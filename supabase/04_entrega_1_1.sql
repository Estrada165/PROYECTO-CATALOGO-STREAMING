-- ════════════════════════════════════════════════════════════════
--  Entrega 1.1 · Ejecutar SOLO si ya corriste 01, 02 y 03 antes.
--  (Si instalas desde cero, basta con 01 → 02 → 03; ya lo incluyen.)
-- ════════════════════════════════════════════════════════════════

alter table public.tenant_settings drop column if exists font_pair;
alter table public.tenant_settings add column if not exists font_display text not null default 'bricolage';
alter table public.tenant_settings add column if not exists font_body text not null default 'plus-jakarta';
alter table public.tenant_settings add column if not exists font_cards text not null default 'plus-jakarta';
alter table public.tenant_settings add column if not exists discounts_enabled boolean not null default false;
alter table public.tenant_settings add column if not exists help_texts jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.tenant_settings add constraint tenant_settings_font_display_check check (font_display in ('bricolage','sora','space-grotesk','unbounded','syne','outfit','plus-jakarta','manrope','dm-sans','inter-tight','lexend','fraunces','montserrat','rubik','poppins','dm-serif'));
  alter table public.tenant_settings add constraint tenant_settings_font_body_check check (font_body in ('bricolage','sora','space-grotesk','unbounded','syne','outfit','plus-jakarta','manrope','dm-sans','inter-tight','lexend','fraunces','montserrat','rubik','poppins','dm-serif'));
  alter table public.tenant_settings add constraint tenant_settings_font_cards_check check (font_cards in ('bricolage','sora','space-grotesk','unbounded','syne','outfit','plus-jakarta','manrope','dm-sans','inter-tight','lexend','fraunces','montserrat','rubik','poppins','dm-serif'));
exception when duplicate_object then null; end $$;

create or replace function public.get_public_catalog(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t tenants%rowtype;
  s tenant_settings%rowtype;
begin
  select * into t from tenants where slug = lower(trim(p_slug));
  if not found then return null; end if;

  select * into s from tenant_settings where tenant_id = t.id;

  if t.status <> 'active' or t.expires_at <= now() then
    return jsonb_build_object(
      'state', 'unavailable',
      'name', coalesce(s.business_name, t.name),
      'logo_url', s.logo_url,
      'accent', coalesce(s.accent, '#FF6B35'),
      'whatsapp', s.whatsapp
    );
  end if;

  return jsonb_build_object(
    'state', 'ok',
    'slug', t.slug,
    'settings', (
      select to_jsonb(x) - 'tenant_id' - 'updated_at'
      from tenant_settings x where x.tenant_id = t.id
    ),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'icon', c.icon,
             'combo_eligible', c.combo_eligible) order by c.sort, c.name)
      from categories c where c.tenant_id = t.id and c.active
    ), '[]'::jsonb),
    'options', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'period', o.period,
             'access_type', o.access_type, 'days', o.days, 'is_default', o.is_default)
             order by o.sort, o.days)
      from plan_options o where o.tenant_id = t.id and o.active
    ), '[]'::jsonb),
    'platforms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'category_id', p.category_id, 'logo_url', p.logo_url,
        'description', p.description, 'features', p.features, 'restrictions', p.restrictions,
        'tags', p.tags, 'popular_content', p.popular_content,
        'extra_sections', p.extra_sections, 'badge', p.badge,
        'stock', p.stock, 'pricing_mode', p.pricing_mode, 'fixed_price', p.fixed_price,
        'fixed_note', p.fixed_note, 'consult_note', p.consult_note,
        'prices', coalesce((
          select jsonb_agg(jsonb_build_object('option_id', pr.option_id, 'price', pr.price, 'note', pr.note))
          from prices pr join plan_options o2 on o2.id = pr.option_id and o2.active
          where pr.platform_id = p.id
        ), '[]'::jsonb)
      ) order by p.sort, p.name)
      from platforms p where p.tenant_id = t.id and p.active
    ), '[]'::jsonb),
    'discount_rules', case when s.discounts_enabled then coalesce((
      select jsonb_agg(jsonb_build_object('min_items', d.min_items, 'discount', d.discount, 'label', d.label)
             order by d.min_items)
      from discount_rules d where d.tenant_id = t.id and d.active
    ), '[]'::jsonb) else '[]'::jsonb end,
    'combos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cb.id, 'name', cb.name, 'description', cb.description, 'badge', cb.badge,
        'option_id', cb.option_id, 'custom_price', cb.custom_price,
        'platform_ids', (select coalesce(jsonb_agg(ci.platform_id), '[]'::jsonb)
                         from combo_items ci join platforms pp on pp.id = ci.platform_id and pp.active
                         where ci.combo_id = cb.id)
      ) order by cb.sort, cb.name)
      from combos cb where cb.tenant_id = t.id and cb.active
    ), '[]'::jsonb),
    'payment_methods', coalesce((
      select jsonb_agg(to_jsonb(m) - 'tenant_id' - 'active' - 'sort' order by m.sort, m.name)
      from payment_methods m where m.tenant_id = t.id and m.active
    ), '[]'::jsonb),
    'announcements', coalesce((
      select jsonb_agg(to_jsonb(a) - 'tenant_id' - 'is_active' - 'created_at' order by a.sort, a.starts_at desc)
      from announcements a
      where a.tenant_id = t.id and a.is_active and a.starts_at <= now()
        and (a.ends_at is null or a.ends_at > now())
    ), '[]'::jsonb),
    'faqs', coalesce((
      select jsonb_agg(jsonb_build_object('q', f.question, 'a', f.answer) order by f.sort)
      from faqs f where f.tenant_id = t.id and f.active
    ), '[]'::jsonb),
    'bot', (
      select jsonb_build_object('name', b.name, 'enabled', b.enabled, 'greeting', b.greeting,
             'avatar_url', b.avatar_url)
      from bot_settings b where b.tenant_id = t.id
    )
  );
end; $$;


-- Vuelve a cargar tu catálogo C-Stream con los combos a precio propio
-- ejecutando después 03_seed_cstream.sql
