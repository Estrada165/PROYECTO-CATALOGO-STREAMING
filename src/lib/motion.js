export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Cambio de tema con un círculo que se expande desde el botón
export function switchTheme(next, originEl, apply) {
  const run = () => apply(next)
  if (!document.startViewTransition || reducedMotion() || !originEl) { run(); return }
  const r = originEl.getBoundingClientRect()
  const x = r.left + r.width / 2, y = r.top + r.height / 2
  const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  const t = document.startViewTransition(run)
  t.ready.then(() => {
    // Círculo lento y con un leve fundido: se nota, pero no golpea la vista
    document.documentElement.animate(
      { clipPath: [`circle(18px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`], opacity: [0.55, 1] },
      { duration: 820, easing: 'cubic-bezier(.45,0,.15,1)', pseudoElement: '::view-transition-new(root)' },
    )
  }).catch(() => {})
}

// Avión de papel que vuela desde el botón hasta el carrito
const PLANE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M21.5 2.5 10.6 13.4"/><path d="M21.5 2.5 15 21l-4.4-7.6L3 9z" fill="var(--accent)" fill-opacity=".9"/></svg>'

export function flyPlane(fromEl, toEl, onLand) {
  if (!fromEl || !toEl || reducedMotion()) { onLand?.(); return }
  const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect()
  if (b.width === 0) { onLand?.(); return }
  const sx = a.left + a.width / 2, sy = a.top + a.height / 2
  const ex = b.left + b.width / 2, ey = b.top + b.height / 2
  const el = document.createElement('div')
  el.className = 'paper-plane'
  el.innerHTML = PLANE
  el.style.left = `${sx - 11}px`; el.style.top = `${sy - 11}px`
  document.body.appendChild(el)
  // Curva: sube primero y luego planea hacia el carrito
  const dx = ex - sx, dy = ey - sy
  const lift = Math.min(120, Math.abs(dx) * 0.25 + 50)
  const frames = []
  const N = 20
  let prev = { x: 0, y: 0 }
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const x = dx * t
    const y = dy * t - lift * Math.sin(Math.PI * t)
    const ang = i === 0 ? -35 : Math.atan2(y - prev.y, x - prev.x) * 180 / Math.PI + 45
    prev = { x, y }
    frames.push({ transform: `translate(${x}px, ${y}px) rotate(${ang}deg) scale(${1 - 0.3 * t})`, opacity: t > 0.9 ? (1 - t) * 10 : 1 })
  }
  const anim = el.animate(frames, { duration: 1150, easing: 'cubic-bezier(.35,.05,.25,1)' })
  anim.onfinish = () => { el.remove(); onLand?.() }
}

export function bump(el) {
  if (!el || reducedMotion()) return
  el.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(.94)' }, { transform: 'scale(1)' }],
    { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' },
  )
}

export function haptic(ms = 12) {
  try { navigator.vibrate?.(ms) } catch { /* sin vibración */ }
}
