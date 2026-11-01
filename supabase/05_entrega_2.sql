-- ════════════════════════════════════════════════════════════════
--  C-Stream SaaS · Actualización a la Entrega 2 (panel del dueño)
--  Solo si YA tenías instalada una entrega anterior.
--  Orden: 05_entrega_2.sql → 01_schema.sql → 03_seed_cstream.sql
-- ════════════════════════════════════════════════════════════════

-- Firma "Catálogo hecho con C-Stream": apagada por defecto, la decides tú por catálogo
alter table public.tenants add column if not exists show_credit boolean not null default false;

-- Tipografías y ayudas de la Entrega 1.1 (por si saltaste esa actualización)
alter table public.tenant_settings add column if not exists font_display text not null default 'bricolage';
alter table public.tenant_settings add column if not exists font_body text not null default 'plus-jakarta';
alter table public.tenant_settings add column if not exists font_cards text not null default 'plus-jakarta';
alter table public.tenant_settings add column if not exists discounts_enabled boolean not null default false;
alter table public.tenant_settings add column if not exists help_texts jsonb not null default '{}'::jsonb;
alter table public.tenant_settings drop column if exists font_pair;

-- Registro de dueños (Entrega 2.2)
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists business_name text;
alter table public.profiles add column if not exists dismissed boolean not null default false;

-- Asistente Lu (Entrega 3)
alter table public.ai_credentials add column if not exists key_last4 text;
alter table public.ai_credentials alter column model set default 'gemini-3.5-flash-lite';

-- Asistente: imágenes en respuestas y búsqueda web (Entrega 3.1)
alter table public.bot_faqs add column if not exists image_url text;
alter table public.ai_credentials add column if not exists web_search boolean not null default true;

-- Después de esto, ejecuta 01_schema.sql completo: actualiza funciones, permisos y seguridad.
