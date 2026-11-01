import { getSupabase } from '../lib/supabase'

// Todas las lecturas y escrituras pasan por Supabase con la sesión del dueño.
// La seguridad la pone la base de datos (RLS): aquí solo se arma cada consulta.

export const BUCKET = 'tenant-assets'

async function sb() {
  const c = await getSupabase()
  if (!c) throw new Error('Falta configurar Supabase en el archivo .env')
  return c
}

// Mensajes claros para los errores más comunes
export function niceError(e) {
  const m = String(e?.message || e || '')
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.'
  if (/Email not confirmed/i.test(m)) return 'Confirma tu correo antes de entrar.'
  if (/already registered|already exists/i.test(m)) return 'Ese correo ya tiene una cuenta. Entra o recupera tu contraseña.'
  if (/Password should be/i.test(m)) return 'La contraseña debe tener al menos 8 caracteres.'
  if (/row-level security|permission denied|violates row-level/i.test(m)) return 'No tienes permiso para este cambio. Si tu plan venció, renueva para volver a editar.'
  if (/duplicate key/i.test(m)) return 'Ya existe un registro igual.'
  if (/check constraint/i.test(m)) return 'Hay un dato con formato no válido. Revisa los campos marcados.'
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.'
  return m || 'Algo salió mal. Inténtalo de nuevo.'
}

const must = ({ data, error }) => { if (error) throw error; return data }

// ── Sesión ──
export async function getSession() {
  const c = await sb()
  const { data } = await c.auth.getSession()
  return data.session
}
export async function onAuth(cb) {
  const c = await sb()
  const { data } = c.auth.onAuthStateChange((event, session) => cb(event, session))
  return () => data.subscription.unsubscribe()
}
export async function signIn(email, password) {
  const c = await sb()
  return must(await c.auth.signInWithPassword({ email: email.trim(), password }))
}
export async function signUp({ email, password, full_name, phone, business_name }) {
  const c = await sb()
  return must(await c.auth.signUp({
    email: email.trim(), password,
    options: { data: { full_name: full_name.trim(), phone: phone.replace(/\D/g, ''), business_name: business_name.trim() }, emailRedirectTo: `${location.origin}/entrar` },
  }))
}
export async function signOut() { const c = await sb(); await c.auth.signOut() }
export async function sendReset(email) {
  const c = await sb()
  return must(await c.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/clave` }))
}
export async function setPassword(password) {
  const c = await sb()
  return must(await c.auth.updateUser({ password }))
}

// ── Contexto: perfil + catálogo ──
export async function loadMe() {
  const c = await sb()
  const { data: { session } } = await c.auth.getSession()
  const user = session?.user
  if (!user) return null
  const profile = must(await c.from('profiles')
    .select('role, tenant_id, email, full_name, business_name, tenant:tenants(id, slug, name, plan, starts_at, expires_at, status)')
    .eq('user_id', user.id).maybeSingle())
  return { user, profile }
}
export async function loadTenant(id) {
  const c = await sb()
  return must(await c.from('tenants').select('id, slug, name, plan, starts_at, expires_at, status').eq('id', id).maybeSingle())
}
export async function listTenantsAdmin() {
  const c = await sb()
  return must(await c.rpc('admin_list_tenants'))
}

// Todo lo del catálogo en paralelo
export async function loadAll(tid) {
  const c = await sb()
  const q = (t, sel = '*', order = 'sort') => {
    let r = c.from(t).select(sel).eq('tenant_id', tid)
    if (order) r = r.order(order, { ascending: true })
    return r
  }
  const [settings, categories, options, platforms, prices, rules, combos, items, payments, anns, faqs, bot, botFaqs, library, usage] = await Promise.all([
    c.from('tenant_settings').select('*').eq('tenant_id', tid).maybeSingle(),
    q('categories'), q('plan_options'), q('platforms'), q('prices', '*', null),
    q('discount_rules', '*', 'min_items'), q('combos'), q('combo_items', '*', null),
    q('payment_methods'), q('announcements'), q('faqs'),
    c.from('bot_settings').select('*').eq('tenant_id', tid).maybeSingle(),
    q('bot_faqs', '*', null),
    c.from('library_platforms').select('*').eq('active', true).order('sort'),
    c.from('ai_usage').select('day, count').eq('tenant_id', tid).order('day', { ascending: false }).limit(31),
  ])
  for (const r of [settings, categories, options, platforms, prices, rules, combos, items, payments, anns, faqs, bot, botFaqs, library]) if (r.error) throw r.error
  const priceMap = {}
  for (const p of prices.data) (priceMap[p.platform_id] ||= []).push(p)
  return {
    settings: settings.data,
    categories: categories.data,
    options: options.data,
    platforms: platforms.data.map(p => ({ ...p, prices: priceMap[p.id] || [] })),
    rules: rules.data,
    combos: combos.data.map(cb => ({ ...cb, platform_ids: items.data.filter(i => i.combo_id === cb.id).map(i => i.platform_id) })),
    payments: payments.data,
    anns: anns.data,
    faqs: faqs.data,
    bot: bot.data,
    botFaqs: botFaqs.data,
    library: library.data,
    usage: usage.data || [],
  }
}

// ── Escrituras genéricas ──
const clean = (row, drop = []) => {
  const out = { ...row }
  for (const k of ['created_at', 'updated_at', 'prices', 'platform_ids', ...drop]) delete out[k]
  return out
}
export async function saveRow(table, tid, row, drop = []) {
  const c = await sb()
  const data = clean({ ...row, tenant_id: tid }, drop)
  if (!data.id) delete data.id
  return must(await c.from(table).upsert(data).select().single())
}
export async function deleteRow(table, id) {
  const c = await sb()
  return must(await c.from(table).delete().eq('id', id))
}
export async function reorder(table, ids) {
  const c = await sb()
  return must(await c.rpc('reorder', { p_table: table, p_ids: ids }))
}
export async function saveSettings(tid, patch) {
  const c = await sb()
  return must(await c.from('tenant_settings').update(clean(patch, ['tenant_id'])).eq('tenant_id', tid).select().single())
}
export async function saveBot(tid, patch) {
  const c = await sb()
  return must(await c.from('bot_settings').upsert({ ...clean(patch), tenant_id: tid }).select().single())
}

// Plataforma + sus precios (precios vacíos = no se vende en esa opción)
export async function savePlatform(tid, platform, priceRows) {
  const c = await sb()
  const saved = await saveRow('platforms', tid, platform)
  const keep = priceRows.filter(r => r.price !== '' && r.price != null && !Number.isNaN(Number(r.price)))
  const drop = priceRows.filter(r => !keep.includes(r)).map(r => r.option_id)
  if (drop.length) must(await c.from('prices').delete().eq('platform_id', saved.id).in('option_id', drop))
  if (keep.length) {
    must(await c.from('prices').upsert(
      keep.map(r => ({ tenant_id: tid, platform_id: saved.id, option_id: r.option_id, price: Number(r.price), note: r.note?.trim() || null })),
      { onConflict: 'platform_id,option_id' },
    ))
  }
  return saved
}

// Cambios sueltos desde la tabla de precios: [{platform_id, option_id, price|null}]
export async function savePriceCells(tid, cells) {
  const c = await sb()
  const up = cells.filter(x => x.price != null)
  const del = cells.filter(x => x.price == null)
  if (up.length) must(await c.from('prices').upsert(up.map(x => ({ tenant_id: tid, platform_id: x.platform_id, option_id: x.option_id, price: x.price })), { onConflict: 'platform_id,option_id' }))
  for (const x of del) must(await c.from('prices').delete().eq('platform_id', x.platform_id).eq('option_id', x.option_id))
}

export async function saveCombo(tid, combo) {
  const c = await sb()
  const saved = await saveRow('combos', tid, combo)
  must(await c.from('combo_items').delete().eq('combo_id', saved.id))
  if (combo.platform_ids?.length) {
    must(await c.from('combo_items').insert(combo.platform_ids.map(pid => ({ combo_id: saved.id, platform_id: pid, tenant_id: tid }))))
  }
  return saved
}

// ── Imágenes: se convierten a WebP en el navegador antes de subir ──
export async function toWebp(file, max = 512, quality = 0.86) {
  if (!/^image\//.test(file.type)) throw new Error('El archivo debe ser una imagen (PNG, JPG o WebP).')
  if (file.size > 12 * 1024 * 1024) throw new Error('La imagen pesa más de 12 MB.')
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k)
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  cv.getContext('2d').drawImage(bmp, 0, 0, w, h)
  const blob = await new Promise(r => cv.toBlob(r, 'image/webp', quality))
  return blob || file
}
export async function uploadImage(tid, file, kind = 'img', max = 512) {
  const c = await sb()
  const blob = await toWebp(file, max)
  const path = `${tid}/${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.webp`
  must(await c.storage.from(BUCKET).upload(path, blob, { contentType: 'image/webp', upsert: true, cacheControl: '31536000' }))
  return c.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// ── Superadmin ──
export async function adminRpc(fn, args = {}) {
  const c = await sb()
  return must(await c.rpc(fn, args))
}
export async function adminLogAll(sinceIso) {
  const c = await sb()
  return must(await c.from('subscription_log').select('tenant_id, action, days_delta, amount, created_at').gte('created_at', sinceIso))
}
export async function adminSettings() {
  const c = await sb()
  return must(await c.from('admin_settings').select('*').eq('id', 1).maybeSingle())
}
export async function saveAdminSettings(patch) {
  const c = await sb()
  return must(await c.from('admin_settings').upsert({ id: 1, ...patch }).select().single())
}

// ── Asistente (función de servidor "lu") ──
export async function invokeLu(body) {
  const c = await sb()
  const { data, error } = await c.functions.invoke('lu', { body })
  if (error) {
    let msg = error.message
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error } catch { /* sin detalle */ }
    throw new Error(/Failed to send|fetch/i.test(msg) ? 'No se encontró la función "lu". Revisa que esté desplegada en Supabase (ver LEEME).' : msg)
  }
  if (data?.error) throw new Error(data.error)
  return data
}
