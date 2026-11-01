// Deriva toda la paleta de un solo color de acento, garantizando contraste
// legible (WCAG 4.5:1) en tema claro y en tema oscuro.
import { useMode, modeOklch, modeRgb, modeLrgb, formatHex, wcagContrast, clampChroma } from 'culori/fn'

// Solo los espacios de color que se usan (mantiene el bundle liviano)
useMode(modeRgb); useMode(modeLrgb)
const toOklch = useMode(modeOklch)

const LIGHT_SURFACE = '#ffffff'
const DARK_SURFACE = '#17191e'
const INK_DARK = '#121316'
const INK_LIGHT = '#ffffff'

function shift(color, dl) {
  const c = toOklch(color)
  const l = Math.min(0.99, Math.max(0.02, (c.l || 0) + dl))
  // Los grises (negro, blanco) no tienen tono: se fija en 0 para no producir NaN
  return formatHex(clampChroma({ mode: 'oklch', l, c: c.c || 0, h: c.h ?? 0 }, 'oklch'))
}

// Oscurece (o aclara) el color hasta alcanzar el contraste pedido contra un fondo
// Mueve la luminosidad desde el color original (sin acumular redondeos a hex)
function reach(color, against, ratio, dir) {
  let out = formatHex(color)
  for (let i = 1; i <= 50 && wcagContrast(out, against) < ratio; i++) out = shift(color, dir * 0.02 * i)
  return out
}

export function derivePalette(accentHex) {
  const original = formatHex(accentHex) || '#ff6b35'
  let accent = original
  // Texto del botón: blanco o casi negro, el que se lea mejor
  let onAccent = wcagContrast(INK_LIGHT, accent) >= wcagContrast(INK_DARK, accent) ? INK_LIGHT : INK_DARK
  if (wcagContrast(onAccent, accent) < 4.5) {
    // Ninguno alcanza: se ajusta el tono del botón lo mínimo necesario
    const darker = reach(accent, INK_LIGHT, 4.5, -1)
    const lighter = reach(accent, INK_DARK, 4.5, +1)
    const dL = x => Math.abs(toOklch(x).l - toOklch(accent).l)
    if (dL(darker) <= dL(lighter)) { accent = darker; onAccent = INK_LIGHT } else { accent = lighter; onAccent = INK_DARK }
  }
  return {
    accent,
    onAccent,
    accentEdge: shift(accent, -0.16),                       // borde inferior de la "tecla"
    accentTextLight: reach(original, LIGHT_SURFACE, 4.5, -1),  // precios y enlaces en claro
    accentTextDark: reach(original, DARK_SURFACE, 4.5, +1),    // precios y enlaces en oscuro
    adjusted: accent !== original,
  }
}

export function applyPalette(el, accentHex) {
  const p = derivePalette(accentHex)
  el.style.setProperty('--accent', p.accent)
  el.style.setProperty('--on-accent', p.onAccent)
  el.style.setProperty('--accent-edge', p.accentEdge)
  el.style.setProperty('--accent-text-light', p.accentTextLight)
  el.style.setProperty('--accent-text-dark', p.accentTextDark)
  return p
}
