import { getSupabase, hasSupabase } from './supabase'

// Trae todo el catálogo público en una sola llamada.
// Sin Supabase configurado, usa el catálogo de demostración (solo para "cstream").
export async function fetchCatalog(slug) {
  const clean = String(slug || '').trim().toLowerCase()
  if (!hasSupabase) {
    if (clean !== 'cstream') return null
    const demo = await import('../demo/cstream.json')
    return demo.default
  }
  const supabase = await getSupabase()
  const { data, error } = await supabase.rpc('get_public_catalog', { p_slug: clean })
  if (error) throw error
  return data
}

// Índices útiles para la interfaz
export function indexCatalog(cat) {
  const options = cat.options || []
  const platforms = cat.platforms || []
  const byId = Object.fromEntries(platforms.map(p => [p.id, p]))
  const optionById = Object.fromEntries(options.map(o => [o.id, o]))
  const catById = Object.fromEntries((cat.categories || []).map(c => [c.id, c]))
  const defaultOption = options.find(o => o.is_default) || options[0] || null
  return { options, platforms, byId, optionById, catById, defaultOption }
}

// Precio de una plataforma para una opción. null = no se vende en esa opción.
export function priceFor(platform, optionId) {
  if (!platform) return null
  if (platform.pricing_mode === 'fixed') return platform.fixed_price != null ? Number(platform.fixed_price) : null
  if (platform.pricing_mode === 'consult') return null
  const row = (platform.prices || []).find(r => r.option_id === optionId)
  return row ? Number(row.price) : null
}

export function priceNoteFor(platform, optionId) {
  if (platform.pricing_mode === 'fixed') return platform.fixed_note || 'Precio único'
  if (platform.pricing_mode === 'consult') return platform.consult_note
  return (platform.prices || []).find(r => r.option_id === optionId)?.note || null
}

// ¿Aparece la plataforma bajo la opción elegida?
export function visibleUnder(platform, optionId) {
  if (platform.pricing_mode !== 'options') return true
  return priceFor(platform, optionId) != null
}
