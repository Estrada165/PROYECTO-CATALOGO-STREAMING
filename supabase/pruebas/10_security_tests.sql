\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;

-- Helpers (corren con el rol de quien llama)
create or replace function public.t_ok(c boolean, label text) returns void language plpgsql as $$
begin if c is distinct from true then raise exception 'FAIL: %', label; end if; raise notice 'PASS: %', label; end $$;
create or replace function public.t_count(q text) returns bigint language plpgsql as $$
declare n bigint; begin execute 'select count(*) from (' || q || ') s' into n; return n; end $$;
create or replace function public.t_exec_rows(q text) returns bigint language plpgsql as $$
declare n bigint; begin execute q; get diagnostics n = row_count; return n; end $$;
create or replace function public.t_fails(q text, label text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then raise notice 'PASS: % (bloqueado: %)', label, sqlerrm; return; end;
  raise exception 'FAIL: % (no fue bloqueado)', label;
end $$;
grant execute on function public.t_ok(boolean,text), public.t_count(text), public.t_exec_rows(text), public.t_fails(text,text) to anon, authenticated;

insert into auth.users (email) values ('super@test.pe'), ('dueno@test.pe'), ('dueno2@test.pe'), ('nadie@test.pe');
select t_ok((select count(*) from profiles) = 4, 'perfiles creados automáticamente al registrarse');
update profiles set role = 'superadmin' where email = 'super@test.pe';   -- paso del SQL Editor
select t_ok((select role from profiles where email='super@test.pe') = 'superadmin', 'SQL Editor puede nombrar superadmin');

select id as super_id from auth.users where email='super@test.pe' \gset
select id as d1 from auth.users where email='dueno@test.pe' \gset
select id as d2 from auth.users where email='dueno2@test.pe' \gset
select id as nadie from auth.users where email='nadie@test.pe' \gset
select id as cs from tenants where slug='cstream' \gset
select set_config('t.cs', :'cs', false);

-- ═══ ANÓNIMO (cliente final) ═══
set role anon; select set_config('request.jwt.claims', '', false);
select t_ok((get_public_catalog('cstream'))->>'state' = 'ok', 'anon: catálogo cstream disponible');
select t_ok(jsonb_array_length(get_public_catalog('cstream')->'platforms') = 23, 'anon: 23 plataformas activas (CapCut oculto)');
select t_ok(jsonb_array_length(get_public_catalog('cstream')->'options') = 3, 'anon: 3 opciones de plan');
select t_ok(jsonb_array_length(get_public_catalog('cstream')->'combos') = 9, 'anon: 9 combos');
select t_ok(jsonb_array_length(get_public_catalog('cstream')->'payment_methods') = 5, 'anon: 5 métodos de pago');
select t_ok(jsonb_array_length(get_public_catalog('cstream')->'announcements') = 2, 'anon: 2 avisos vigentes');
select t_ok(jsonb_array_length(get_public_catalog('cstream')->'faqs') = 7, 'anon: 7 preguntas frecuentes');
select t_ok((select jsonb_array_length(p->'prices') from jsonb_array_elements(get_public_catalog('cstream')->'platforms') p where p->>'name'='Netflix') = 2,
            'anon: Netflix tiene 2 precios (sin cuenta completa)');
select t_ok((select p->>'pricing_mode' from jsonb_array_elements(get_public_catalog('cstream')->'platforms') p where p->>'name' like 'Google%') = 'fixed',
            'anon: Google 2TB con precio único');
select t_ok(get_public_catalog('CStream ')->>'state' = 'ok', 'anon: slug sin distinguir mayúsculas ni espacios');
select t_ok(get_public_catalog('no-existe') is null, 'anon: slug inexistente devuelve null');
select t_ok(not (get_public_catalog('cstream') ? 'ai'), 'anon: el catálogo público no expone credenciales de IA');
select t_ok(get_public_catalog('cstream')::text not like '%ciphertext%', 'anon: ninguna key cifrada en la respuesta pública');
select t_fails('select * from tenants', 'anon: no lee la tabla tenants');
select t_fails('select * from platforms', 'anon: no lee plataformas directo');
select t_fails('select * from ai_credentials', 'anon: no lee credenciales de IA');
select t_ok(t_count('select * from library_platforms') = 30, 'anon: lee la biblioteca (30)');
select t_fails($q$select admin_create_tenant('hack','Hack')$q$, 'anon: no crea catálogos');
select t_fails($q$select admin_add_days(current_setting('t.cs')::uuid, 999)$q$, 'anon: no suma días');
select t_fails($q$insert into storage.objects (bucket_id, name) values ('tenant-assets', current_setting('t.cs') || '/x.webp')$q$, 'anon: no sube archivos');
reset role;

-- ═══ USUARIO SIN CATÁLOGO ═══
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'nadie')::text, false);
select t_ok(t_count('select id, slug from tenants') = 0, 'sin catálogo: no ve ningún tenant');
select t_ok(t_count('select * from platforms') = 0, 'sin catálogo: no ve plataformas');
select t_fails($q$insert into faqs (tenant_id, question, answer) values (current_setting('t.cs')::uuid, 'x','y')$q$, 'sin catálogo: no escribe en catálogos ajenos');
reset role;

-- ═══ SUPERADMIN ═══
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'super_id')::text, false);
select admin_create_tenant('tienda-dos', 'Tienda Dos', 'mensual', 30, 'Ana', '999888777', 25) as t2 \gset
select set_config('t.t2', :'t2', false);
select t_ok(t_count($q$select * from plan_options where tenant_id = current_setting('t.t2')::uuid$q$) = 3, 'superadmin: catálogo nuevo trae 3 opciones por defecto');
select t_ok(t_count($q$select * from categories where tenant_id = current_setting('t.t2')::uuid$q$) = 5, 'superadmin: catálogo nuevo trae 5 categorías');
select t_ok(t_count($q$select * from discount_rules where tenant_id = current_setting('t.t2')::uuid$q$) = 2, 'superadmin: catálogo nuevo trae reglas de descuento');
select t_ok((select name from bot_settings where tenant_id = current_setting('t.t2')::uuid) = 'Lu', 'superadmin: bot "Lu" por defecto');
select t_ok(t_count($q$select * from subscription_log where tenant_id = current_setting('t.t2')::uuid and action='alta'$q$) = 1, 'superadmin: alta registrada en historial');
select t_fails($q$select admin_create_tenant('tienda-dos', 'Copia')$q$, 'superadmin: slug duplicado rechazado');
select t_fails($q$select admin_create_tenant('Mal Slug!', 'Nombre valido')$q$, 'superadmin: slug con caracteres inválidos rechazado');
select admin_link_owner('cstream', 'dueno@test.pe');
select admin_link_owner('tienda-dos', 'dueno2@test.pe');
select t_fails($q$select admin_link_owner('cstream', 'noexiste@test.pe')$q$, 'superadmin: no vincula cuentas no registradas');
update ai_credentials set label_email = 'cstream.bot1@gmail.com', api_key_ciphertext = 'CIFRADO' where tenant_id = current_setting('t.cs')::uuid;
select t_ok(t_count('select * from ai_credentials') = 2, 'superadmin: ve credenciales de todos');
-- FK compuesta: no se puede mezclar plataformas de un catálogo con precios de otro
select t_fails($q$insert into prices (tenant_id, platform_id, option_id, price)
  select current_setting('t.t2')::uuid, p.id, o.id, 1 from platforms p, plan_options o
  where p.tenant_id = current_setting('t.cs')::uuid and o.tenant_id = current_setting('t.t2')::uuid limit 1$q$,
  'integridad: precio no puede cruzar catálogos');
reset role;

-- ═══ DUEÑO DE C-STREAM ═══
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'d1')::text, false);
select t_ok(t_count('select id, slug, expires_at, status from tenants') = 1, 'dueño: ve solo su catálogo');
select t_fails('select notes from tenants', '2: dueño NO lee tus notas privadas');
select t_fails('select amount_paid, contact_phone from tenants', '2: dueño NO lee montos ni contacto');
select t_ok(t_count('select * from admin_list_tenants()') = 0, '2: admin_list_tenants vacío para el dueño');
select t_ok(t_count('select * from platforms') = 24, 'dueño: ve sus 24 plataformas (incluye inactivas)');
select t_ok(t_count($q$select * from platforms where tenant_id = current_setting('t.t2')::uuid$q$) = 0, 'dueño: no ve plataformas de otro dueño');
select t_ok(t_count('select * from ai_credentials') = 0, 'dueño: NO ve su key de Gemini');
select t_ok(t_exec_rows($q$update prices set price = 11 where tenant_id = current_setting('t.cs')::uuid
  and platform_id = (select id from platforms where name='Netflix') and option_id = (select id from plan_options where period='1 mes' and access_type='profile')$q$) = 1,
  'dueño: cambia el precio de Netflix');
select t_ok((select (p->'prices'->0->>'price')::numeric from jsonb_array_elements(get_public_catalog('cstream')->'platforms') p where p->>'name'='Netflix') in (11, 34),
  'dueño: el cambio se ve en el catálogo público al instante');
select t_ok(t_exec_rows($q$update prices set price = 0 where tenant_id = current_setting('t.t2')::uuid$q$) = 0, 'dueño: no modifica precios de otro dueño');
select t_fails($q$insert into platforms (tenant_id, name) values (current_setting('t.t2')::uuid, 'Intruso')$q$, 'dueño: no crea plataformas en otro catálogo');
select t_ok(t_exec_rows($q$update tenants set expires_at = now() + interval '10 years'$q$) = 0, 'dueño: no se extiende sus propios días');
select t_ok(t_exec_rows($q$update profiles set role = 'superadmin'$q$) = 0, 'dueño: no se sube a superadmin');
select t_fails($q$select admin_add_days(current_setting('t.cs')::uuid, 30)$q$, 'dueño: no llama acciones de superadmin');
select t_ok(t_count('select * from subscription_log') >= 1, 'dueño: ve su historial de pagos');
select t_fails($q$insert into subscription_log (tenant_id, action) values (current_setting('t.cs')::uuid, 'renovacion')$q$, 'dueño: no escribe en su historial');
select t_fails($q$insert into ai_usage (tenant_id, day, count) values (current_setting('t.cs')::uuid, current_date, 0)$q$, 'dueño: no altera su contador de IA');
-- plan options libres
insert into plan_options (tenant_id, label, period, access_type, days, sort, is_default)
values (current_setting('t.cs')::uuid, 'Perfil', '2 meses promo', 'profile', 60, 4, true);
select t_ok(t_count($q$select * from plan_options where tenant_id = current_setting('t.cs')::uuid and is_default$q$) = 1, 'dueño: solo una opción queda por defecto');
select t_ok(jsonb_array_length(get_public_catalog('cstream')->'options') = 4, 'dueño: nueva duración "2 meses promo" aparece en el catálogo');
-- avisos con fechas
insert into announcements (tenant_id, title, starts_at) values (current_setting('t.cs')::uuid, 'Aviso futuro', now() + interval '2 days');
insert into announcements (tenant_id, title, starts_at, ends_at) values (current_setting('t.cs')::uuid, 'Aviso vencido', now() - interval '5 days', now() - interval '1 day');
select t_ok(jsonb_array_length(get_public_catalog('cstream')->'announcements') = 2, 'avisos: futuros y vencidos no se muestran');
select t_fails($q$insert into announcements (tenant_id, title, starts_at, ends_at) values (current_setting('t.cs')::uuid, 'Mal', now(), now() - interval '1 day')$q$, 'avisos: fin antes del inicio rechazado');
-- validaciones
select t_fails($q$update tenant_settings set accent = 'naranja'$q$, 'validación: color debe ser hexadecimal');
select t_fails($q$update tenant_settings set whatsapp = '+51 904'$q$, 'validación: WhatsApp solo dígitos');
select t_fails($q$update tenant_settings set radius = 60$q$, 'validación: radio entre 8 y 28');
-- storage
insert into storage.objects (bucket_id, name) values ('tenant-assets', current_setting('t.cs') || '/logo.webp');
select t_ok(true, 'storage: dueño sube a su carpeta');
select t_fails($q$insert into storage.objects (bucket_id, name) values ('tenant-assets', current_setting('t.t2') || '/x.webp')$q$, 'storage: no sube a carpeta ajena');
select t_fails($q$insert into storage.objects (bucket_id, name) values ('tenant-assets', 'basura/x.webp')$q$, 'storage: ruta sin catálogo rechazada');
reset role;

-- ═══ VENCIMIENTO Y SUSPENSIÓN ═══
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'super_id')::text, false);
select admin_set_expiry(current_setting('t.cs')::uuid, now() - interval '1 day', 'prueba de vencimiento');
reset role;
set role anon; select set_config('request.jwt.claims', '', false);
select t_ok(get_public_catalog('cstream')->>'state' = 'unavailable', 'vencido: catálogo público muestra mantenimiento');
select t_ok(not (get_public_catalog('cstream') ? 'platforms'), 'vencido: no expone precios');
reset role;
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'d1')::text, false);
select t_ok(t_count('select * from platforms') = 24, 'vencido: el dueño aún ve sus datos');
select t_ok(t_exec_rows('update platforms set sort = sort') = 0, 'vencido: el dueño queda en solo lectura');
reset role;
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'super_id')::text, false);
select t_ok(admin_add_days(current_setting('t.cs')::uuid, 30, 30, 'renovación') > now() + interval '29 days', 'renovar: vencido cuenta 30 días desde hoy');
select admin_set_status(current_setting('t.cs')::uuid, 'suspended', 'falta de pago');
reset role;
set role anon; select set_config('request.jwt.claims', '', false);
select t_ok(get_public_catalog('cstream')->>'state' = 'unavailable', 'suspendido: catálogo no disponible');
reset role;
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'super_id')::text, false);
select admin_set_status(current_setting('t.cs')::uuid, 'active', 'pagó');
select t_ok(t_count($q$select * from subscription_log where tenant_id = current_setting('t.cs')::uuid$q$) >= 5, 'historial: registra cada movimiento');
reset role;
set role anon; select set_config('request.jwt.claims', '', false);
select t_ok(get_public_catalog('cstream')->>'state' = 'ok', 'reactivado: catálogo vuelve a estar disponible');
reset role;

-- ═══ ENTREGA 1.1 ═══
set role anon; select set_config('request.jwt.claims', '', false);
select t_ok(jsonb_array_length(get_public_catalog('cstream')->'discount_rules') = 0, '1.1: descuentos por cantidad apagados por defecto');
select t_ok((select count(*) from jsonb_array_elements(get_public_catalog('cstream')->'combos') c where c->>'custom_price' is not null) = 9, '1.1: los 9 combos tienen precio propio');
select t_ok(get_public_catalog('cstream')->'settings'->>'font_display' = 'bricolage', '1.1: tipografía de títulos en la respuesta');
reset role;
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'d1')::text, false);
update tenant_settings set discounts_enabled = true;
select t_ok(jsonb_array_length(get_public_catalog('cstream')->'discount_rules') = 2, '1.1: el dueño activa los descuentos y aparecen');
update tenant_settings set discounts_enabled = false;
select t_fails($q$update tenant_settings set font_display = 'comic-sans'$q$, '1.1: solo tipografías de la lista');
update tenant_settings set font_cards = 'unbounded';
select t_ok(get_public_catalog('cstream')->'settings'->>'font_cards' = 'unbounded', '1.1: tipografía de tarjetas independiente');
reset role;

-- ═══ ENTREGA 2 (panel) ═══
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'super_id')::text, false);
select t_ok(t_count('select * from admin_list_tenants()') = 2, '2: superadmin lista todos los catálogos');
select t_ok((select (j->>'owner_email') from admin_list_tenants() j where j->>'slug' = 'cstream') = 'dueno@test.pe', '2: la lista muestra el correo del dueño');
reset role;
set role anon; select set_config('request.jwt.claims', '', false);
select t_ok((get_public_catalog('cstream')->>'credit')::boolean = false, '2: firma "hecho con C-Stream" apagada por defecto');
reset role;
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'d1')::text, false);
select t_ok(t_exec_rows($q$update tenants set show_credit = true$q$) = 0, '2: el dueño no cambia la firma');
select reorder('faqs', array(select id from faqs order by sort desc));
select t_ok((select question from faqs order by sort limit 1) like '¿YouTube%', '2: el dueño reordena sus preguntas');
select t_fails($q$select reorder('tenants', array[gen_random_uuid()])$q$, '2: reorder solo en tablas permitidas');
reset role;
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'d2')::text, false);
select t_ok(t_count($q$select * from faqs where tenant_id = current_setting('t.cs')::uuid$q$) = 0, '2: el dueño 2 no ve las preguntas de C-Stream');
reset role;
select string_agg(id::text, ',' order by sort) as cs_before, '{' || string_agg(id::text, ',' order by sort desc) || '}' as cs_rev from faqs where tenant_id = current_setting('t.cs')::uuid \gset
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'d2')::text, false);
select reorder('faqs', :'cs_rev'::uuid[]);
reset role;
select t_ok((select string_agg(id::text, ',' order by sort) from faqs where tenant_id = current_setting('t.cs')::uuid) = :'cs_before', '2: reorder no toca catálogos ajenos (RLS)');

-- ═══ SUPERADMIN (panel propio) ═══
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'d1')::text, false);
select t_fails($q$select admin_update_tenant(current_setting('t.cs')::uuid, '{"name":"Hack"}')$q$, 'admin: el dueño no edita datos del catálogo');
select t_fails($q$select admin_delete_tenant(current_setting('t.cs')::uuid, 'cstream')$q$, 'admin: el dueño no borra catálogos');
select t_ok(t_count('select * from admin_settings') = 0, 'admin: el dueño no ve los ajustes del superadmin');
select t_ok(t_count($q$select * from admin_tenant_log(current_setting('t.cs')::uuid)$q$) = 0, 'admin: el dueño no ve el historial completo');
reset role;
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'super_id')::text, false);
select admin_update_tenant(current_setting('t.t2')::uuid, '{"notes":"Paga por Yape","show_credit":true,"plan":"anual"}');
select t_ok((select (j->>'notes') from admin_list_tenants() j where j->>'slug'='tienda-dos') = 'Paga por Yape', 'admin: edita notas');
select t_ok((get_public_catalog('tienda-dos')->>'credit')::boolean, 'admin: enciende la firma en un catálogo');
select t_fails($q$select admin_delete_tenant(current_setting('t.t2')::uuid, 'otro-slug')$q$, 'admin: borrar exige escribir el slug correcto');
select admin_unlink_owner('dueno2@test.pe');
select t_ok((select tenant_id from profiles where email='dueno2@test.pe') is null, 'admin: desvincula a un dueño');
select admin_delete_tenant(current_setting('t.t2')::uuid, 'tienda-dos');
select t_ok(t_count('select * from admin_list_tenants()') = 1, 'admin: borra un catálogo con todo su contenido');
update admin_settings set renewal_template = 'Hola {nombre}';
select t_ok((select renewal_template from admin_settings) = 'Hola {nombre}', 'admin: guarda su plantilla de renovación');
reset role;

-- ═══ REGISTRO DE DUEÑOS ═══
insert into auth.users (email, raw_user_meta_data) values ('nuevo@test.pe', '{"full_name":"Luis","phone":"+51 911 222 333","business_name":"Stream Luis"}');
select t_ok((select phone from profiles where email='nuevo@test.pe') = '51911222333', 'registro: guarda nombre, teléfono y negocio');
select t_ok((select role from profiles where email='nuevo@test.pe') = 'owner' and (select tenant_id from profiles where email='nuevo@test.pe') is null, 'registro: entra sin catálogo (pendiente)');
select id as nuevo from auth.users where email='nuevo@test.pe' \gset
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'nuevo')::text, false);
select t_ok(t_count('select * from platforms') = 0, 'registro: una cuenta pendiente no ve ningún catálogo');
select t_ok(t_count('select * from admin_pending_owners()') = 0, 'registro: no ve la lista de solicitudes');
select t_ok(t_exec_rows($q$update profiles set role = 'superadmin'$q$) = 0, 'registro: no se puede dar el rol de superadmin');
reset role;
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'super_id')::text, false);
select t_ok((select count(*) from admin_pending_owners() j where j->>'email' = 'nuevo@test.pe') = 1, 'admin: ve la solicitud nueva');
select admin_dismiss_owner('nuevo@test.pe');
select t_ok((select count(*) from admin_pending_owners() j where j->>'email' = 'nuevo@test.pe') = 0, 'admin: descarta una solicitud');
reset role;

-- ═══ ASISTENTE LU ═══
update ai_credentials set daily_limit = 3, per_visitor_limit = 2, api_key_ciphertext = 'x' where tenant_id = current_setting('t.cs')::uuid;
select t_ok((lu_take(current_setting('t.cs')::uuid, 'visitante-aaaa')->>'ok')::boolean, 'lu: primer mensaje permitido');
select t_ok((lu_take(current_setting('t.cs')::uuid, 'visitante-aaaa')->>'ok')::boolean, 'lu: segundo mensaje permitido');
select t_ok(lu_take(current_setting('t.cs')::uuid, 'visitante-aaaa')->>'reason' = 'visitor', 'lu: límite por visitante');
select t_ok((lu_take(current_setting('t.cs')::uuid, 'visitante-bbbb')->>'ok')::boolean, 'lu: otro visitante sí puede');
select t_ok(lu_take(current_setting('t.cs')::uuid, 'visitante-cccc')->>'reason' = 'tenant', 'lu: límite diario del catálogo');
set role anon; select set_config('request.jwt.claims', '', false);
select t_fails($q$select lu_take(current_setting('t.cs')::uuid, 'visitante-dddd')$q$, 'lu: el público no puede gastar cupo directo');
select t_ok((get_public_catalog('cstream')->'bot'->>'live')::boolean, 'lu: el catálogo sabe que el asistente está activo');
select t_ok(get_public_catalog('cstream')::text not like '%api_key%', 'lu: la clave nunca sale en el catálogo');
reset role;
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'d1')::text, false);
select t_ok(admin_ai_status(current_setting('t.cs')::uuid) is null, 'lu: el dueño no ve el estado de la clave');
select t_fails($q$select lu_take(current_setting('t.cs')::uuid, 'visitante-eeee')$q$, 'lu: el dueño no puede gastar cupo directo');
reset role;
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'super_id')::text, false);
select t_ok((admin_ai_status(current_setting('t.cs')::uuid)->>'today')::int = 3, 'lu: tu panel ve el consumo de hoy');
select t_ok((admin_ai_status(current_setting('t.cs')::uuid)->>'has_key')::boolean and admin_ai_status(current_setting('t.cs')::uuid)::text not like '%"x"%', 'lu: tu panel sabe que hay clave pero no la ve');
reset role;

-- ═══ DATOS SUGERIDOS ═══
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'super_id')::text, false);
select admin_create_tenant('tienda-tres', 'Tienda Tres') as t3 \gset
select t_ok((select count(*) from platforms where tenant_id = :'t3' and not active) = (select count(*) from library_platforms where active), 'sugeridos: catálogo nuevo trae la biblioteca completa, apagada');
select t_ok((select count(*) from platforms where tenant_id = :'t3' and category_id is null) = 0, 'sugeridos: cada plataforma queda en su categoría');
select t_ok((select count(*) from payment_methods where tenant_id = :'t3' and not active and qr_url is null and account is null) = 9, 'sugeridos: 9 bancos y billeteras apagados, sin datos');
select t_ok((select count(*) from faqs where tenant_id = :'t3') = 4, 'sugeridos: 4 preguntas frecuentes base');
select t_ok((admin_seed_defaults(:'t3')->>'platforms')::int = 0, 'sugeridos: volver a cargar no duplica');
select t_ok(jsonb_array_length(get_public_catalog('tienda-tres')->'platforms') = 0, 'sugeridos: el catálogo público no muestra lo apagado');
reset role;
set role authenticated; select set_config('request.jwt.claims', json_build_object('sub', :'d1')::text, false);
select t_fails($q$select admin_seed_defaults(current_setting('t.cs')::uuid)$q$, 'sugeridos: el dueño no puede ejecutarlo');
reset role;
