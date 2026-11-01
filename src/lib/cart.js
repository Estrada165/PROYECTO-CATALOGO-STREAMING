import { priceFor } from './catalog'
import { money, optionName, momentOfDay } from './format'

// Línea del carrito: { key, kind: 'platform'|'combo', platformId?, optionId?, comboId?, qty }
export const lineKey = (platformId, optionId) => `${platformId}:${optionId || 'unico'}`

export function cartReducer(state, action) {
  switch (action.type) {
    case 'add': {
      const i = state.findIndex(l => l.key === action.line.key)
      if (i >= 0) return state.map((l, j) => (j === i ? { ...l, qty: Math.min(20, l.qty + 1) } : l))
      return [...state, { ...action.line, qty: 1 }]
    }
    case 'dec':
      return state.flatMap(l => (l.key !== action.key ? [l] : l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []))
    case 'remove':
      return state.filter(l => l.key !== action.key)
    case 'clear':
      return []
    case 'load':
      return Array.isArray(action.lines) ? action.lines : []
    default:
      return state
  }
}

// Calcula líneas con precio, subtotal, descuento por cantidad y total
export function summarize(lines, idx, cat) {
  const rules = [...(cat.discount_rules || [])].sort((a, b) => b.min_items - a.min_items)
  const combosById = Object.fromEntries((cat.combos || []).map(c => [c.id, c]))
  let eligible = 0
  const rows = []
  for (const l of lines) {
    if (l.kind === 'combo') {
      const c = combosById[l.comboId]
      if (!c || c.custom_price == null) continue
      const logos = c.platform_ids.map(id => idx.byId[id]).filter(Boolean)
      rows.push({ ...l, name: c.name, detail: `${logos.map(p => p.name).join(' + ')} · ${optionName(idx.optionById[c.option_id])}`, unit: Number(c.custom_price), logos })
      continue
    }
    const p = idx.byId[l.platformId]
    if (!p) continue
    const unit = priceFor(p, l.optionId)
    if (unit == null) continue
    const o = idx.optionById[l.optionId]
    const detail = p.pricing_mode === 'fixed' ? (p.fixed_note ? 'Precio único' : 'Precio único') : optionName(o)
    if (idx.catById[p.category_id]?.combo_eligible) eligible += l.qty
    rows.push({ ...l, name: p.name, detail, unit, logos: [p] })
  }
  const subtotal = rows.reduce((s, r) => s + r.unit * r.qty, 0)
  const rule = rules.find(r => eligible >= r.min_items) || null
  const discount = rule ? Math.min(Number(rule.discount), subtotal) : 0
  const next = [...rules].reverse().find(r => r.min_items > eligible) || null
  return {
    rows, subtotal, discount, rule, total: subtotal - discount,
    count: rows.reduce((s, r) => s + r.qty, 0),
    nextRule: next ? { ...next, missing: next.min_items - eligible } : null,
  }
}

export const DEFAULT_TEMPLATE =
  'Hola, {saludo} 👋 Soy {nombre}.\n\n🛒 *Mi pedido*\n{items}\n\n{descuento}💰 *Total: {total}*\n💳 Pago con: {metodo}\n\n📎 Te envío mi comprobante.'

export function buildOrderMessage({ summary, settings, name, method }) {
  const sym = settings.currency_symbol || 'S/'
  const items = summary.rows
    .map(r => `▪️ ${r.name}${r.detail ? ` (${r.detail})` : ''}${r.qty > 1 ? ` x${r.qty}` : ''}: ${money(r.unit * r.qty, sym)}`)
    .join('\n')
  const descuento = summary.discount > 0
    ? `🏷️ Descuento ${summary.rule?.label ? `(${summary.rule.label})` : ''}: -${money(summary.discount, sym)}\n`
    : ''
  const tpl = settings.wa_order_template || DEFAULT_TEMPLATE
  return tpl
    .replaceAll('{saludo}', momentOfDay())
    .replaceAll('{nombre}', (name || '').trim() || 'cliente')
    .replaceAll('{items}', items)
    .replaceAll('{subtotal}', money(summary.subtotal, sym))
    .replaceAll('{descuento}', descuento)
    .replaceAll('{total}', money(summary.total, sym))
    .replaceAll('{metodo}', method?.name || 'por confirmar')
    .replace(/\n{3,}/g, '\n\n')
}

export function waLink(number, text) {
  // api.whatsapp.com conserva los emojis; el enlace corto wa.me los rompe al redirigir
  return `https://api.whatsapp.com/send?phone=${String(number || '').replace(/\D/g, '')}&text=${encodeURIComponent(text)}`
}

export function consultMessage(platformName) {
  return `Hola, ${momentOfDay()} 👋 Quisiera consultar por *${platformName}*. ¿Qué disponibilidad y precio tienen? 🙌`
}
