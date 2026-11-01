// 16 tipografías autoalojadas (Fontsource, licencia libre para uso comercial).
// Solo se descarga la que el dueño elige para cada rol.
export const FONTS = {
  'bricolage':     { name: 'Bricolage Grotesque', family: "'Bricolage Grotesque Variable'", style: 'Expresiva', load: () => import('@fontsource-variable/bricolage-grotesque') },
  'sora':          { name: 'Sora',                family: "'Sora Variable'",               style: 'Geométrica', load: () => import('@fontsource-variable/sora') },
  'space-grotesk': { name: 'Space Grotesk',       family: "'Space Grotesk Variable'",      style: 'Técnica', load: () => import('@fontsource-variable/space-grotesk') },
  'unbounded':     { name: 'Unbounded',           family: "'Unbounded Variable'",          style: 'Ancha', load: () => import('@fontsource-variable/unbounded') },
  'syne':          { name: 'Syne',                family: "'Syne Variable'",               style: 'Editorial', load: () => import('@fontsource-variable/syne') },
  'outfit':        { name: 'Outfit',              family: "'Outfit Variable'",             style: 'Redondeada', load: () => import('@fontsource-variable/outfit') },
  'plus-jakarta':  { name: 'Plus Jakarta Sans',   family: "'Plus Jakarta Sans Variable'",  style: 'Limpia', load: () => import('@fontsource-variable/plus-jakarta-sans') },
  'manrope':       { name: 'Manrope',             family: "'Manrope Variable'",            style: 'Moderna', load: () => import('@fontsource-variable/manrope') },
  'dm-sans':       { name: 'DM Sans',             family: "'DM Sans Variable'",            style: 'Neutra', load: () => import('@fontsource-variable/dm-sans') },
  'inter-tight':   { name: 'Inter Tight',         family: "'Inter Tight Variable'",        style: 'Compacta', load: () => import('@fontsource-variable/inter-tight') },
  'lexend':        { name: 'Lexend',              family: "'Lexend Variable'",             style: 'Muy legible', load: () => import('@fontsource-variable/lexend') },
  'montserrat':    { name: 'Montserrat',          family: "'Montserrat Variable'",         style: 'Clásica', load: () => import('@fontsource-variable/montserrat') },
  'rubik':         { name: 'Rubik',               family: "'Rubik Variable'",              style: 'Suave', load: () => import('@fontsource-variable/rubik') },
  'poppins':       { name: 'Poppins',             family: "'Poppins'",                     style: 'Popular', load: () => Promise.all([import('@fontsource/poppins/400.css'), import('@fontsource/poppins/600.css'), import('@fontsource/poppins/700.css')]) },
  'fraunces':      { name: 'Fraunces',            family: "'Fraunces Variable'",           style: 'Serif suave', load: () => import('@fontsource-variable/fraunces') },
  'dm-serif':      { name: 'DM Serif Display',    family: "'DM Serif Display'",            style: 'Serif elegante', load: () => import('@fontsource/dm-serif-display') },
}

const FALLBACK = 'system-ui, -apple-system, "Segoe UI", sans-serif'
const loaded = new Set()

// roles: títulos (display), texto (body), tarjetas (cards: nombre y precio)
export function applyFonts({ display = 'bricolage', body = 'plus-jakarta', cards = 'plus-jakarta' } = {}) {
  const root = document.documentElement.style
  for (const [role, key] of [['display', display], ['body', body], ['cards', cards]]) {
    const f = FONTS[key] || FONTS['plus-jakarta']
    if (!loaded.has(key)) { loaded.add(key); f.load().catch(() => loaded.delete(key)) }
    root.setProperty(`--font-${role}`, `${f.family}, ${FALLBACK}`)
  }
}
