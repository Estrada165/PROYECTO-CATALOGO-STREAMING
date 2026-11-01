import { money } from './format'

// Textos de los íconos (i) del catálogo. El dueño puede reemplazarlos (help_texts).
export const HELP_KEYS = [
  { key: 'plan', label: 'Perfil o cuenta completa', where: 'Junto a los botones de duración' },
  { key: 'delivery', label: 'Entrega', where: 'Tarjeta de entrega, en el inicio' },
  { key: 'warranty', label: 'Garantía', where: 'Tarjeta de garantía, en el inicio' },
  { key: 'payment', label: 'Pagos', where: 'En “Cómo comprar”' },
  { key: 'combos', label: 'Combos', where: 'Junto al título Combos' },
  { key: 'discounts', label: 'Descuentos', where: 'Solo si activas los descuentos' },
]

export function defaultHelp(s, rules = [], sym = 'S/') {
  return {
    plan: 'Perfil: un acceso personal dentro de una cuenta, para 1 dispositivo. Es lo más económico. Cuenta completa: recibes el correo y la contraseña, con control total.',
    delivery: `Cuando confirmamos tu pago, te enviamos tus accesos por WhatsApp${s.delivery_time ? ` en ${s.delivery_time}` : ''}.`,
    warranty: `Si pierdes el acceso sin causa tuya dentro de los ${s.warranty_days || 0} días, lo reponemos sin costo.`,
    payment: 'Eliges el método al terminar tu pedido. Ahí verás el QR y los datos para copiar con un toque.',
    combos: 'Un combo junta varias plataformas a un precio especial. Se agrega al carrito como un solo producto.',
    discounts: (rules.length ? rules.map(r => `${r.label || `Desde ${r.min_items}`}: ahorras ${money(r.discount, sym)}`).join(' · ') : 'Lleva varias plataformas y ahorra') + '. Se descuenta en el carrito.',
  }
}

export function helpTexts(s, rules, sym) {
  const d = defaultHelp(s, rules, sym)
  const own = s.help_texts || {}
  return Object.fromEntries(Object.keys(d).map(k => [k, typeof own[k] === 'string' && own[k].trim() ? own[k] : d[k]]))
}
