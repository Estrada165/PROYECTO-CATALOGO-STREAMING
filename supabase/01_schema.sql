-- ════════════════════════════════════════════════════════════════
--  C-Stream SaaS · Esquema de base de datos (Supabase / Postgres)
--  Ejecutar UNA vez en: Supabase → SQL Editor → New query → Run
--  Orden: 01_schema.sql → 02_library.sql → 03_seed_cstream.sql
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ────────────────────────────────────────────────────────────────
--  1. CATÁLOGOS (dueños que te alquilan) Y PERFILES
-- ────────────────────────────────────────────────────────────────

create table if not exists public.tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
                check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name          text not null check (length(trim(name)) between 2 and 60),
  plan          text not null default 'mensual'
                check (plan in ('mensual','trimestral','semestral','anual','personalizado','demo')),
  starts_at     timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '30 days',
  status        text not null default 'active' check (status in ('active','suspended')),
  contact_name  text,
  contact_phone text,
  amount_paid   numeric(10,2),
  notes         text,
  show_credit   boolean not null default false,  -- muestra "Catálogo hecho con C-Stream" (lo decides tú)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'owner' check (role in ('superadmin','owner')),
  tenant_id  uuid references public.tenants(id) on delete set null,
  full_name     text,            -- datos del registro (los pone el dueño al crear su cuenta)
  phone         text,
  business_name text,
  dismissed     boolean not null default false,  -- solicitud descartada por el superadmin
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists business_name text;
alter table public.profiles add column if not exists dismissed boolean not null default false;
create index if not exists profiles_tenant_idx on public.profiles(tenant_id);

-- ────────────────────────────────────────────────────────────────
--  2. FUNCIONES DE ACCESO (usadas por las políticas RLS)
-- ────────────────────────────────────────────────────────────────

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and role = 'superadmin');
$$;

create or replace function public.my_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from profiles where user_id = auth.uid();
$$;

-- Leer: superadmin, o el dueño de ese catálogo (aunque esté vencido)
create or replace function public.can_read_tenant(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_superadmin() or (t is not null and t = public.my_tenant_id());
$$;

-- Convierte texto a uuid sin lanzar error (para rutas de archivos)
create or replace function public.try_uuid(v text)
returns uuid language plpgsql immutable as $$
begin return v::uuid; exception when others then return null; end; $$;

-- Editar: superadmin, o el dueño con su plan activo y vigente
create or replace function public.can_edit_tenant(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_superadmin() or exists (
    select 1 from tenants
    where id = t and id = public.my_tenant_id()
      and status = 'active' and expires_at > now()
  );
$$;

-- ────────────────────────────────────────────────────────────────
--  3. CONFIGURACIÓN DE MARCA
-- ────────────────────────────────────────────────────────────────

create table if not exists public.tenant_settings (
  tenant_id         uuid primary key references public.tenants(id) on delete cascade,
  business_name     text not null,
  tagline           text,
  description       text,
  logo_url          text,
  logo_shape        text not null default 'squircle' check (logo_shape in ('round','squircle')),
  favicon_url       text,
  accent            text not null default '#FF6B35' check (accent ~ '^#[0-9A-Fa-f]{6}$'),
  theme_default     text not null default 'light' check (theme_default in ('light','dark','system')),
  card_style        text not null default 'tecla' check (card_style in ('tecla','suave','linea')),
  radius            int  not null default 18 check (radius between 8 and 28),
  font_display      text not null default 'bricolage' check (font_display in ('bricolage','sora','space-grotesk','unbounded','syne','outfit','plus-jakarta','manrope','dm-sans','inter-tight','lexend','fraunces','montserrat','rubik','poppins','dm-serif')),
  font_body         text not null default 'plus-jakarta' check (font_body in ('bricolage','sora','space-grotesk','unbounded','syne','outfit','plus-jakarta','manrope','dm-sans','inter-tight','lexend','fraunces','montserrat','rubik','poppins','dm-serif')),
  font_cards        text not null default 'plus-jakarta' check (font_cards in ('bricolage','sora','space-grotesk','unbounded','syne','outfit','plus-jakarta','manrope','dm-sans','inter-tight','lexend','fraunces','montserrat','rubik','poppins','dm-serif')),
  discounts_enabled boolean not null default false,          -- descuento por cantidad: lo activa el dueño
  help_texts        jsonb not null default '{}'::jsonb,       -- textos de los íconos (i); vacío = textos por defecto
  whatsapp          text check (whatsapp ~ '^[0-9]{8,15}$'),
  whatsapp_display  text,
  support_hours     text,
  location          text,
  currency_symbol   text not null default 'S/',
  delivery_time     text,
  warranty_days     int,
  how_to_buy        jsonb not null default '[]'::jsonb,   -- [{title, text}]
  terms             jsonb not null default '[]'::jsonb,   -- [{title, items: []}]
  wa_order_template text,
  show_how_to_buy   boolean not null default true,
  updated_at        timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────
--  4. BIBLIOTECA GLOBAL DE PLATAFORMAS (la administras tú)
-- ────────────────────────────────────────────────────────────────

create table if not exists public.library_platforms (
  id               text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  name             text not null,
  category_key     text not null default 'streaming',
  logo_url         text,
  description      text,
  features         text[] not null default '{}',
  restrictions     text[] not null default '{}',
  tags             text[] not null default '{}',
  popular_content  text[] not null default '{}',
  extra_sections   jsonb  not null default '[]'::jsonb,
  sort             int    not null default 100,
  active           boolean not null default true,
  updated_at       timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────
--  5. CATÁLOGO DE CADA DUEÑO
-- ────────────────────────────────────────────────────────────────

create table if not exists public.categories (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  name           text not null,
  icon           text not null default 'sparkles',
  combo_eligible boolean not null default false,
  sort           int not null default 0,
  active         boolean not null default true,
  unique (id, tenant_id)
);
create index if not exists categories_tenant_idx on public.categories(tenant_id);

-- Opciones del selector: "Perfil · 1 mes", "Perfil · 2 meses promo", "Cuenta completa · 1 mes"...
create table if not exists public.plan_options (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  label       text not null,                 -- "Perfil"
  period      text not null,                 -- "1 mes"
  access_type text not null default 'profile' check (access_type in ('profile','complete','other')),
  days        int  not null default 30 check (days between 1 and 3650),
  sort        int  not null default 0,
  active      boolean not null default true,
  is_default  boolean not null default false,
  unique (id, tenant_id)
);
create index if not exists plan_options_tenant_idx on public.plan_options(tenant_id);

create table if not exists public.platforms (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  library_id     text references public.library_platforms(id) on delete set null,
  category_id    uuid,
  name           text not null,
  logo_url       text,
  description    text,
  features       text[] not null default '{}',
  restrictions   text[] not null default '{}',
  tags           text[] not null default '{}',
  popular_content text[] not null default '{}',
  extra_sections jsonb  not null default '[]'::jsonb,  -- [{title, kind:'steps'|'list'|'note'|'image', items:[], image_url}]
  badge          text check (badge in ('popular','nuevo','oferta','limitado')),
  stock          text not null default 'available' check (stock in ('available','low','out')),
  pricing_mode   text not null default 'options' check (pricing_mode in ('options','fixed','consult')),
  fixed_price    numeric(10,2) check (fixed_price is null or fixed_price >= 0),
  fixed_note     text,
  consult_note   text,
  sort           int not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (category_id, tenant_id) references public.categories(id, tenant_id) on delete set null (category_id)
);
create index if not exists platforms_tenant_idx on public.platforms(tenant_id);

create table if not exists public.prices (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  platform_id uuid not null,
  option_id   uuid not null,
  price       numeric(10,2) not null check (price >= 0),
  note        text,
  unique (platform_id, option_id),
  foreign key (platform_id, tenant_id) references public.platforms(id, tenant_id) on delete cascade,
  foreign key (option_id, tenant_id)   references public.plan_options(id, tenant_id) on delete cascade
);
create index if not exists prices_tenant_idx on public.prices(tenant_id);

create table if not exists public.discount_rules (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  min_items int not null check (min_items >= 2),
  discount  numeric(10,2) not null check (discount >= 0),
  label     text,
  active    boolean not null default true
);
create index if not exists discount_rules_tenant_idx on public.discount_rules(tenant_id);

create table if not exists public.combos (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  name         text not null,
  description  text,
  badge        text,
  option_id    uuid not null,
  custom_price numeric(10,2) check (custom_price is null or custom_price >= 0),
  sort         int not null default 0,
  active       boolean not null default true,
  unique (id, tenant_id),
  foreign key (option_id, tenant_id) references public.plan_options(id, tenant_id) on delete cascade
);
create index if not exists combos_tenant_idx on public.combos(tenant_id);

create table if not exists public.combo_items (
  combo_id    uuid not null,
  platform_id uuid not null,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  primary key (combo_id, platform_id),
  foreign key (combo_id, tenant_id)    references public.combos(id, tenant_id) on delete cascade,
  foreign key (platform_id, tenant_id) references public.platforms(id, tenant_id) on delete cascade
);

create table if not exists public.payment_methods (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  kind          text not null default 'other'
                check (kind in ('yape','plin','bcp','interbank','bbva','scotiabank','lemon','binance','paypal','other')),
  name          text not null,
  account       text,
  account_label text not null default 'Número',
  holder        text,
  qr_url        text,
  logo_url      text,
  note          text,
  instructions  text[] not null default '{}',
  sort          int not null default 0,
  active        boolean not null default true
);
create index if not exists payment_methods_tenant_idx on public.payment_methods(tenant_id);

create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  title       text not null check (length(trim(title)) between 2 and 90),
  message     text,
  image_url   text,
  tone        text not null default 'accent' check (tone in ('accent','info','success','warning')),
  cta_label   text,
  cta_kind    text not null default 'none' check (cta_kind in ('none','platform','whatsapp','url')),
  cta_value   text,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  show_popup  boolean not null default true,
  is_active   boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists announcements_tenant_idx on public.announcements(tenant_id);

create table if not exists public.faqs (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  question  text not null,
  answer    text not null,
  sort      int not null default 0,
  active    boolean not null default true
);
create index if not exists faqs_tenant_idx on public.faqs(tenant_id);

-- ────────────────────────────────────────────────────────────────
--  6. BOT (Lu) — la key de Gemini NUNCA es visible para el dueño
-- ────────────────────────────────────────────────────────────────

create table if not exists public.bot_settings (
  tenant_id  uuid primary key references public.tenants(id) on delete cascade,
  name       text not null default 'Lu' check (length(trim(name)) between 1 and 24),
  tone       text not null default 'cercano' check (tone in ('cercano','formal','juvenil')),
  greeting   text,
  avatar_url text,
  enabled    boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_faqs (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  question  text not null,
  answer    text not null,
  keywords  text[] not null default '{}',
  image_url text,                       -- imagen que Lu muestra con esta respuesta
  active    boolean not null default true
);
alter table public.bot_faqs add column if not exists image_url text;
create index if not exists bot_faqs_tenant_idx on public.bot_faqs(tenant_id);

-- Solo superadmin y la función de servidor (service key) la leen
create table if not exists public.ai_credentials (
  tenant_id          uuid primary key references public.tenants(id) on delete cascade,
  label_email        text,                         -- solo referencia: qué Gmail es
  api_key_ciphertext text,                         -- cifrada por la función de servidor
  model              text not null default 'gemini-3.5-flash-lite',
  key_last4          text,                         -- solo para reconocerla en tu panel
  daily_limit        int  not null default 200 check (daily_limit between 0 and 100000),
  per_visitor_limit  int  not null default 20  check (per_visitor_limit between 1 and 1000),
  updated_at         timestamptz not null default now()
);

create table if not exists public.ai_usage (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  day       date not null,
  count     int  not null default 0,
  primary key (tenant_id, day)
);
alter table public.ai_credentials add column if not exists key_last4 text;
alter table public.ai_credentials add column if not exists web_search boolean not null default true;  -- busca en Google solo para películas y series

-- Mensajes por visitante y día (para que nadie agote la cuota de un catálogo)
create table if not exists public.ai_visitor_usage (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  day       date not null,
  visitor   text not null check (length(visitor) between 8 and 64),
  count     int  not null default 0,
  primary key (tenant_id, day, visitor)
);

-- ────────────────────────────────────────────────────────────────
--  7. HISTORIAL DE SUSCRIPCIÓN
-- ────────────────────────────────────────────────────────────────

create table if not exists public.subscription_log (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  action     text not null check (action in ('alta','renovacion','ajuste','suspension','reactivacion')),
  days_delta int not null default 0,
  amount     numeric(10,2),
  note       text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists subscription_log_tenant_idx on public.subscription_log(tenant_id);

-- ────────────────────────────────────────────────────────────────
--  8. TRIGGERS
-- ────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists tenants_touch on public.tenants;
create trigger tenants_touch before update on public.tenants
  for each row execute function public.touch_updated_at();
drop trigger if exists settings_touch on public.tenant_settings;
create trigger settings_touch before update on public.tenant_settings
  for each row execute function public.touch_updated_at();

-- Perfil automático al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, full_name, phone, business_name)
  values (new.id, new.email,
          left(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 80),
          left(regexp_replace(coalesce(new.raw_user_meta_data->>'phone', ''), '[^0-9]', '', 'g'), 15),
          left(nullif(trim(new.raw_user_meta_data->>'business_name'), ''), 60))
  on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Un dueño no puede cambiar su propio rol ni su catálogo
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() nulo = SQL Editor o service key (tú); se permite
  if auth.uid() is not null and not public.is_superadmin() and
     (new.role is distinct from old.role or new.tenant_id is distinct from old.tenant_id or new.dismissed is distinct from old.dismissed) then
    raise exception 'Solo el superadmin puede cambiar roles o catálogos';
  end if;
  return new;
end; $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Una sola opción por defecto por catálogo
create or replace function public.single_default_option()
returns trigger language plpgsql as $$
begin
  if new.is_default then
    update public.plan_options set is_default = false
    where tenant_id = new.tenant_id and id <> new.id and is_default;
  end if;
  return new;
end; $$;

drop trigger if exists plan_options_default on public.plan_options;
create trigger plan_options_default after insert or update of is_default on public.plan_options
  for each row when (new.is_default) execute function public.single_default_option();

-- ────────────────────────────────────────────────────────────────
--  9. SEGURIDAD (Row Level Security)
-- ────────────────────────────────────────────────────────────────

alter table public.tenants           enable row level security;
alter table public.profiles          enable row level security;
alter table public.library_platforms enable row level security;
alter table public.ai_credentials    enable row level security;
alter table public.ai_usage          enable row level security;
alter table public.subscription_log  enable row level security;
alter table public.ai_visitor_usage  enable row level security;  -- sin políticas: solo el servidor

-- tenants: el dueño ve el suyo; solo superadmin crea, edita o borra
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants for select to authenticated
  using (public.can_read_tenant(id));
drop policy if exists tenants_admin on public.tenants;
create policy tenants_admin on public.tenants for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.is_superadmin());
drop policy if exists profiles_admin on public.profiles;
create policy profiles_admin on public.profiles for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- biblioteca: lectura pública, escritura superadmin
drop policy if exists library_read on public.library_platforms;
create policy library_read on public.library_platforms for select to anon, authenticated
  using (active or public.is_superadmin());
drop policy if exists library_admin on public.library_platforms;
create policy library_admin on public.library_platforms for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- Tablas del catálogo: el dueño lee siempre lo suyo y edita mientras su plan esté vigente
do $$
declare t text;
begin
  foreach t in array array[
    'tenant_settings','categories','plan_options','platforms','prices','discount_rules',
    'combos','combo_items','payment_methods','announcements','faqs','bot_settings','bot_faqs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.can_read_tenant(tenant_id))', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_edit_tenant(tenant_id))', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_edit_tenant(tenant_id)) with check (public.can_edit_tenant(tenant_id))', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_edit_tenant(tenant_id))', t || '_delete', t);
  end loop;
end $$;

-- ai_credentials: SOLO superadmin (el servidor usa la service key, que salta RLS)
drop policy if exists ai_credentials_admin on public.ai_credentials;
create policy ai_credentials_admin on public.ai_credentials for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- ai_usage: el dueño ve su consumo; nadie escribe desde el navegador
drop policy if exists ai_usage_select on public.ai_usage;
create policy ai_usage_select on public.ai_usage for select to authenticated
  using (public.can_read_tenant(tenant_id));

-- subscription_log: el dueño ve su historial; solo superadmin escribe
drop policy if exists sublog_select on public.subscription_log;
create policy sublog_select on public.subscription_log for select to authenticated
  using (public.can_read_tenant(tenant_id));
drop policy if exists sublog_admin on public.subscription_log;
create policy sublog_admin on public.subscription_log for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- Permisos base (Supabase los da por defecto; se dejan explícitos)
grant usage on schema public to anon, authenticated;
grant select on public.library_platforms to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.ai_usage from authenticated;

-- tenants: el dueño solo puede leer los datos de su plan; tus notas, montos y contacto
-- quedan para el superadmin (se leen con admin_list_tenants)
revoke select on public.tenants from authenticated;
grant select (id, slug, name, plan, starts_at, expires_at, status, show_credit, created_at, updated_at)
  on public.tenants to authenticated;

-- ────────────────────────────────────────────────────────────────
--  10. CATÁLOGO PÚBLICO — una sola llamada trae todo
-- ────────────────────────────────────────────────────────────────

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
    'credit', t.show_credit,
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
             'avatar_url', b.avatar_url,
             'live', b.enabled and exists (select 1 from ai_credentials k where k.tenant_id = t.id and k.api_key_ciphertext is not null and k.daily_limit > 0))
      from bot_settings b where b.tenant_id = t.id
    )
  );
end; $$;

revoke all on function public.get_public_catalog(text) from public;
grant execute on function public.get_public_catalog(text) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────
--  11. ACCIONES DEL SUPERADMIN
-- ────────────────────────────────────────────────────────────────

-- Crea un catálogo con todo lo necesario para arrancar
create or replace function public.admin_create_tenant(
  p_slug text, p_name text, p_plan text default 'mensual', p_days int default 30,
  p_contact_name text default null, p_contact_phone text default null, p_amount numeric default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.is_superadmin() then raise exception 'Solo el superadmin puede crear catálogos'; end if;
  if p_days < 1 then raise exception 'Los días deben ser 1 o más'; end if;

  insert into tenants (slug, name, plan, expires_at, contact_name, contact_phone, amount_paid)
  values (lower(trim(p_slug)), trim(p_name), p_plan, now() + make_interval(days => p_days),
          p_contact_name, p_contact_phone, p_amount)
  returning id into v_id;

  insert into tenant_settings (tenant_id, business_name, currency_symbol, how_to_buy)
  values (v_id, trim(p_name), 'S/', jsonb_build_array(
    jsonb_build_object('title','Elige tus plataformas','text','Busca, filtra y agrega al carrito lo que necesitas.'),
    jsonb_build_object('title','Revisa tu pedido','text','Suma todas las que quieras y revisa el total antes de pagar.'),
    jsonb_build_object('title','Paga','text','Usa el método que prefieras y guarda tu comprobante.'),
    jsonb_build_object('title','Envía tu pedido','text','Te llega por WhatsApp con tu acceso.')
  ));

  insert into categories (tenant_id, name, icon, combo_eligible, sort) values
    (v_id, 'Streaming', 'tv', true, 1),
    (v_id, 'Música', 'music', true, 2),
    (v_id, 'Herramientas', 'wand', false, 3),
    (v_id, 'TV en vivo', 'radio', false, 4),
    (v_id, 'Especiales', 'sparkles', false, 5);

  insert into plan_options (tenant_id, label, period, access_type, days, sort, is_default) values
    (v_id, 'Perfil', '1 mes', 'profile', 30, 1, true),
    (v_id, 'Perfil', '3 meses', 'profile', 90, 2, false),
    (v_id, 'Cuenta completa', '1 mes', 'complete', 30, 3, false);

  insert into discount_rules (tenant_id, min_items, discount, label) values
    (v_id, 2, 1.00, 'Combo dúo'), (v_id, 3, 2.00, 'Combo trío o más');

  insert into bot_settings (tenant_id, name) values (v_id, 'Lu');
  insert into ai_credentials (tenant_id) values (v_id);
  perform public.admin_seed_defaults(v_id);   -- plataformas y bancos sugeridos (apagados)

  insert into subscription_log (tenant_id, action, days_delta, amount, note, created_by)
  values (v_id, 'alta', p_days, p_amount, 'Alta del catálogo', auth.uid());

  return v_id;
end; $$;

-- Suma (o resta) días. Si ya venció, cuenta desde hoy.
create or replace function public.admin_add_days(p_tenant uuid, p_days int, p_amount numeric default null, p_note text default null)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_exp timestamptz;
begin
  if not public.is_superadmin() then raise exception 'Solo el superadmin'; end if;
  update tenants
     set expires_at = case when p_days > 0 then greatest(expires_at, now()) + make_interval(days => p_days)
                           else expires_at + make_interval(days => p_days) end
   where id = p_tenant returning expires_at into v_exp;
  if not found then raise exception 'Catálogo no encontrado'; end if;
  insert into subscription_log (tenant_id, action, days_delta, amount, note, created_by)
  values (p_tenant, case when p_days > 0 then 'renovacion' else 'ajuste' end, p_days, p_amount, p_note, auth.uid());
  return v_exp;
end; $$;

-- Fija la fecha de vencimiento exacta
create or replace function public.admin_set_expiry(p_tenant uuid, p_expires timestamptz, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_old timestamptz;
begin
  if not public.is_superadmin() then raise exception 'Solo el superadmin'; end if;
  select expires_at into v_old from tenants where id = p_tenant;
  if not found then raise exception 'Catálogo no encontrado'; end if;
  update tenants set expires_at = p_expires where id = p_tenant;
  insert into subscription_log (tenant_id, action, days_delta, note, created_by)
  values (p_tenant, 'ajuste', extract(day from (p_expires - v_old))::int, p_note, auth.uid());
end; $$;

create or replace function public.admin_set_status(p_tenant uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'Solo el superadmin'; end if;
  update tenants set status = p_status where id = p_tenant;
  if not found then raise exception 'Catálogo no encontrado'; end if;
  insert into subscription_log (tenant_id, action, note, created_by)
  values (p_tenant, case when p_status = 'active' then 'reactivacion' else 'suspension' end, p_note, auth.uid());
end; $$;

-- Vincula una cuenta (ya registrada) como dueño de un catálogo
create or replace function public.admin_link_owner(p_slug text, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_user uuid;
begin
  if not public.is_superadmin() then raise exception 'Solo el superadmin'; end if;
  select id into v_tenant from tenants where slug = lower(trim(p_slug));
  if v_tenant is null then raise exception 'Catálogo % no existe', p_slug; end if;
  select user_id into v_user from profiles where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'La cuenta % aún no se ha registrado', p_email; end if;
  update profiles set tenant_id = v_tenant, role = 'owner', dismissed = false where user_id = v_user;
end; $$;

-- Lista completa de catálogos para tu panel (incluye notas, montos y contacto)
create or replace function public.admin_list_tenants()
returns setof jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(t) || jsonb_build_object(
    'owner_email', (select string_agg(p.email, ', ') from profiles p where p.tenant_id = t.id and p.role = 'owner'),
    'days_left', greatest(0, ceil(extract(epoch from (t.expires_at - now())) / 86400))::int
  )
  from tenants t
  where public.is_superadmin()
  order by t.expires_at;
$$;

-- Ordena filas de una tabla del catálogo. Corre con los permisos de quien llama (RLS aplica).
create or replace function public.reorder(p_table text, p_ids uuid[])
returns void language plpgsql security invoker set search_path = public as $$
declare i int;
begin
  if p_table not in ('categories','plan_options','platforms','combos','payment_methods','announcements','faqs') then
    raise exception 'Tabla no permitida';
  end if;
  for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
    execute format('update public.%I set sort = $1 where id = $2', p_table) using i * 10, p_ids[i];
  end loop;
end; $$;

-- Ajustes generales del superadmin (una sola fila)
create table if not exists public.admin_settings (
  id                 int primary key default 1 check (id = 1),
  renewal_template   text,
  support_whatsapp   text,
  updated_at         timestamptz not null default now()
);
alter table public.admin_settings enable row level security;
drop policy if exists admin_settings_all on public.admin_settings;
create policy admin_settings_all on public.admin_settings for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
grant select, insert, update on public.admin_settings to authenticated;
insert into public.admin_settings (id) values (1) on conflict do nothing;

-- Edita los datos de un catálogo (nombre, plan, contacto, notas, firma)
create or replace function public.admin_update_tenant(p_tenant uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'Solo el superadmin'; end if;
  update tenants set
    name          = coalesce(nullif(trim(p->>'name'), ''), name),
    plan          = coalesce(p->>'plan', plan),
    contact_name  = case when p ? 'contact_name'  then nullif(trim(p->>'contact_name'), '')  else contact_name end,
    contact_phone = case when p ? 'contact_phone' then nullif(trim(p->>'contact_phone'), '') else contact_phone end,
    notes         = case when p ? 'notes'         then nullif(trim(p->>'notes'), '')         else notes end,
    show_credit   = coalesce((p->>'show_credit')::boolean, show_credit)
  where id = p_tenant;
  if not found then raise exception 'Catálogo no encontrado'; end if;
end; $$;

-- Desvincula a un dueño (su cuenta queda sin catálogo)
create or replace function public.admin_unlink_owner(p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'Solo el superadmin'; end if;
  update profiles set tenant_id = null where lower(email) = lower(trim(p_email)) and role = 'owner';
end; $$;

-- Borra un catálogo con todo su contenido (pide escribir el slug para confirmar)
create or replace function public.admin_delete_tenant(p_tenant uuid, p_confirm_slug text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'Solo el superadmin'; end if;
  delete from tenants where id = p_tenant and slug = lower(trim(p_confirm_slug));
  if not found then raise exception 'El slug no coincide'; end if;
end; $$;

-- Historial de un catálogo
create or replace function public.admin_tenant_log(p_tenant uuid)
returns setof subscription_log language sql stable security definer set search_path = public as $$
  select * from subscription_log where tenant_id = p_tenant and public.is_superadmin() order by created_at desc limit 50;
$$;

-- Cuentas registradas que esperan un catálogo
create or replace function public.admin_pending_owners()
returns setof jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('email', email, 'full_name', full_name, 'phone', phone, 'business_name', business_name, 'created_at', created_at)
  from profiles
  where public.is_superadmin() and role = 'owner' and tenant_id is null and not dismissed
  order by created_at desc;
$$;
create or replace function public.admin_dismiss_owner(p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'Solo el superadmin'; end if;
  update profiles set dismissed = true where lower(email) = lower(trim(p_email)) and tenant_id is null;
end; $$;

-- Cupo del asistente: cuenta un mensaje si hay espacio en el día (catálogo y visitante).
-- Solo lo usa la función de servidor (service key).
create or replace function public.lu_take(p_tenant uuid, p_visitor text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_day date := (now() at time zone 'America/Lima')::date; v_lim int; v_per int; v_used int; v_mine int;
begin
  select daily_limit, per_visitor_limit into v_lim, v_per from ai_credentials where tenant_id = p_tenant;
  if v_lim is null then return jsonb_build_object('ok', false, 'reason', 'off'); end if;
  insert into ai_usage (tenant_id, day, count) values (p_tenant, v_day, 0) on conflict do nothing;
  select count into v_used from ai_usage where tenant_id = p_tenant and day = v_day for update;
  if v_used >= v_lim then return jsonb_build_object('ok', false, 'reason', 'tenant'); end if;
  insert into ai_visitor_usage (tenant_id, day, visitor, count) values (p_tenant, v_day, p_visitor, 0) on conflict do nothing;
  select count into v_mine from ai_visitor_usage where tenant_id = p_tenant and day = v_day and visitor = p_visitor for update;
  if v_mine >= v_per then return jsonb_build_object('ok', false, 'reason', 'visitor'); end if;
  update ai_usage set count = count + 1 where tenant_id = p_tenant and day = v_day;
  update ai_visitor_usage set count = count + 1 where tenant_id = p_tenant and day = v_day and visitor = p_visitor;
  return jsonb_build_object('ok', true, 'left', v_per - v_mine - 1);
end; $$;

-- Estado de la IA de un catálogo para tu panel (nunca devuelve la clave)
create or replace function public.admin_ai_status(p_tenant uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('label_email', k.label_email, 'model', k.model, 'daily_limit', k.daily_limit,
         'per_visitor_limit', k.per_visitor_limit, 'key_last4', k.key_last4, 'has_key', k.api_key_ciphertext is not null, 'web_search', k.web_search,
         'today', coalesce((select count from ai_usage u where u.tenant_id = p_tenant and u.day = (now() at time zone 'America/Lima')::date), 0))
  from ai_credentials k where k.tenant_id = p_tenant and public.is_superadmin();
$$;

-- Carga lo sugerido en un catálogo: plataformas de la biblioteca (apagadas, con su
-- logo y textos), bancos y billeteras (apagados, solo logo) y preguntas frecuentes base.
-- No duplica: solo agrega lo que falta. El dueño enciende y pone precios.
create or replace function public.admin_seed_defaults(p_tenant uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_p int; v_m int; v_f int;
begin
  if not public.is_superadmin() then raise exception 'Solo el superadmin'; end if;
  insert into platforms (tenant_id, library_id, name, logo_url, description, features, restrictions, tags, popular_content, extra_sections, category_id, active, sort)
  select p_tenant, l.id, l.name, l.logo_url, l.description, l.features, l.restrictions, l.tags, l.popular_content, l.extra_sections,
         (select c.id from categories c where c.tenant_id = p_tenant and lower(c.name) = any (case l.category_key
            when 'streaming' then array['streaming'] when 'music' then array['música','musica']
            when 'tools' then array['herramientas'] when 'iptv' then array['tv en vivo','iptv']
            else array['especiales'] end) limit 1),
         false, 1000 + l.sort
  from library_platforms l
  where l.active and not exists (select 1 from platforms x where x.tenant_id = p_tenant and x.library_id = l.id);
  get diagnostics v_p = row_count;

  insert into payment_methods (tenant_id, kind, name, logo_url, account_label, active, sort)
  select p_tenant, k, n, lg, lb, false, s from (values
    ('yape','YAPE','/library/pay/yape.webp','Número',10), ('plin','PLIN','/library/pay/plin.webp','Número',20),
    ('bcp','BCP','/library/pay/bcp.webp','Cuenta',30), ('interbank','Interbank',null,'Cuenta',40),
    ('bbva','BBVA',null,'Cuenta',50), ('scotiabank','Scotiabank',null,'Cuenta',60),
    ('lemon','LEMON','/library/pay/lemon.webp','Usuario',70), ('binance','Binance Pay','/library/pay/binance.webp','Pay ID',80),
    ('paypal','PayPal',null,'Correo',90)
  ) as d(k, n, lg, lb, s)
  where not exists (select 1 from payment_methods m where m.tenant_id = p_tenant and m.kind = d.k);
  get diagnostics v_m = row_count;

  insert into faqs (tenant_id, question, answer, sort)
  select p_tenant, q, a, s from (values
    ('¿Qué es un acceso por perfil?', 'Es un acceso personal dentro de una cuenta compartida, para 1 dispositivo. Es la opción más económica.', 10),
    ('¿Qué es una cuenta completa?', 'Recibes el correo y la contraseña. Puedes usarla en tus dispositivos con control total.', 20),
    ('¿Cuánto tarda la entrega?', 'Apenas confirmamos tu pago, te enviamos tus accesos por WhatsApp.', 30),
    ('¿Cómo pago?', 'Al finalizar tu pedido eliges el método: verás el QR y los datos para copiar. Luego nos envías el comprobante por WhatsApp.', 40)
  ) as d(q, a, s)
  where not exists (select 1 from faqs f where f.tenant_id = p_tenant);
  get diagnostics v_f = row_count;
  return jsonb_build_object('platforms', v_p, 'payments', v_m, 'faqs', v_f);
end; $$;

revoke all on function public.admin_create_tenant(text,text,text,int,text,text,numeric) from public, anon;
revoke all on function public.admin_add_days(uuid,int,numeric,text) from public, anon;
revoke all on function public.admin_set_expiry(uuid,timestamptz,text) from public, anon;
revoke all on function public.admin_set_status(uuid,text,text) from public, anon;
revoke all on function public.admin_link_owner(text,text) from public, anon;
revoke all on function public.admin_list_tenants() from public, anon;
revoke all on function public.admin_update_tenant(uuid, jsonb) from public, anon;
revoke all on function public.admin_unlink_owner(text) from public, anon;
revoke all on function public.admin_delete_tenant(uuid, text) from public, anon;
revoke all on function public.admin_tenant_log(uuid) from public, anon;
revoke all on function public.admin_pending_owners() from public, anon;
revoke all on function public.admin_seed_defaults(uuid) from public, anon;
grant execute on function public.admin_seed_defaults(uuid) to authenticated;
revoke all on function public.lu_take(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_ai_status(uuid) from public, anon;
grant execute on function public.admin_ai_status(uuid) to authenticated;
revoke all on function public.admin_dismiss_owner(text) from public, anon;
grant execute on function public.admin_pending_owners() to authenticated;
grant execute on function public.admin_dismiss_owner(text) to authenticated;
grant execute on function public.admin_update_tenant(uuid, jsonb) to authenticated;
grant execute on function public.admin_unlink_owner(text) to authenticated;
grant execute on function public.admin_delete_tenant(uuid, text) to authenticated;
grant execute on function public.admin_tenant_log(uuid) to authenticated;
revoke all on function public.reorder(text, uuid[]) from public, anon;
grant execute on function public.admin_list_tenants() to authenticated;
grant execute on function public.reorder(text, uuid[]) to authenticated;
grant execute on function public.admin_create_tenant(text,text,text,int,text,text,numeric) to authenticated;
grant execute on function public.admin_add_days(uuid,int,numeric,text) to authenticated;
grant execute on function public.admin_set_expiry(uuid,timestamptz,text) to authenticated;
grant execute on function public.admin_set_status(uuid,text,text) to authenticated;
grant execute on function public.admin_link_owner(text,text) to authenticated;

-- ────────────────────────────────────────────────────────────────
--  12. ALMACENAMIENTO DE IMÁGENES
--  Ruta: tenant-assets/<tenant_id>/archivo.webp
-- ────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('tenant-assets', 'tenant-assets', true)
on conflict (id) do nothing;

drop policy if exists tenant_assets_read on storage.objects;
create policy tenant_assets_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'tenant-assets');

drop policy if exists tenant_assets_insert on storage.objects;
create policy tenant_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-assets'
    and public.can_edit_tenant(public.try_uuid((storage.foldername(name))[1])));

drop policy if exists tenant_assets_update on storage.objects;
create policy tenant_assets_update on storage.objects for update to authenticated
  using (bucket_id = 'tenant-assets'
    and public.can_edit_tenant(public.try_uuid((storage.foldername(name))[1])));

drop policy if exists tenant_assets_delete on storage.objects;
create policy tenant_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'tenant-assets'
    and public.can_edit_tenant(public.try_uuid((storage.foldername(name))[1])));
