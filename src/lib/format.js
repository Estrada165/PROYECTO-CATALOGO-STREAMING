export function money(value, symbol = 'S/') {
  const n = Number(value || 0)
  return `${symbol} ${n.toFixed(2)}`
}

export function optionName(o) {
  if (!o) return ''
  return `${o.label} · ${o.period}`
}

export function momentOfDay(d = new Date()) {
  const h = d.getHours()
  if (h >= 5 && h < 12) return 'buenos días'
  if (h >= 12 && h < 19) return 'buenas tardes'
  return 'buenas noches'
}

// localStorage puede fallar (modo privado, iframes): siempre envuelto
export const store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v) } catch { return fallback }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* sin almacenamiento */ }
  },
}

export const session = {
  get(key) { try { return sessionStorage.getItem(key) } catch { return null } },
  set(key, v) { try { sessionStorage.setItem(key, v) } catch { /* sin almacenamiento */ } },
}
