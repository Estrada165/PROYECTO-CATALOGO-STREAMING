import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, LayoutGrid, Tv, Music, Wand2, Radio, Sparkles, Gamepad2, BookOpen, Dumbbell, GraduationCap, Film, Trophy, Shield, Cloud, Palette, Briefcase } from 'lucide-react'

// Íconos que el dueño puede elegir para cada categoría (se guardan por nombre)
export const CAT_ICONS = {
  tv: Tv, music: Music, wand: Wand2, radio: Radio, film: Film, trophy: Trophy, gamepad: Gamepad2,
  book: BookOpen, school: GraduationCap, fitness: Dumbbell, shield: Shield, cloud: Cloud,
  palette: Palette, work: Briefcase, sparkles: Sparkles,
}
export const catIcon = name => CAT_ICONS[name] || Sparkles

// Filtro por categoría: lo arma el dueño en "Duraciones y categorías".
// Si no entran todas, salen flechas a los lados (y la rueda del mouse también lo mueve).
export default function CategoryFilter({ cats, value, onChange, countFor }) {
  const ref = useRef(null)
  const [edge, setEdge] = useState({ l: false, r: false })
  const sync = () => {
    const el = ref.current; if (!el) return
    setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }
  useEffect(() => {
    const el = ref.current; if (!el) return
    sync()
    const ro = new ResizeObserver(sync); ro.observe(el)
    const wheel = e => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      const max = el.scrollWidth - el.clientWidth
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return
      e.preventDefault(); el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => { ro.disconnect(); el.removeEventListener('wheel', wheel) }
  }, [cats.length])
  // La categoría elegida siempre queda a la vista
  useEffect(() => {
    const el = ref.current, b = el?.querySelector('[aria-pressed="true"]'); if (!b) return
    const pad = 44, l = b.offsetLeft - el.offsetLeft, r = l + b.offsetWidth
    if (l - pad < el.scrollLeft) el.scrollTo({ left: Math.max(0, l - pad), behavior: 'smooth' })
    else if (r + pad > el.scrollLeft + el.clientWidth) el.scrollTo({ left: r + pad - el.clientWidth, behavior: 'smooth' })
  }, [value])
  const go = dir => ref.current?.scrollBy({ left: dir * Math.max(160, ref.current.clientWidth * 0.7), behavior: 'smooth' })

  return (
    <div className={`catf-wrap${edge.l ? ' is-l' : ''}${edge.r ? ' is-r' : ''}`}>
      {edge.l && <button className="catf__arrow catf__arrow--l" onClick={() => go(-1)} aria-label="Ver categorías anteriores" tabIndex={-1}><ChevronLeft size={18} /></button>}
      <div className="catf" ref={ref} onScroll={sync} role="group" aria-label="Filtrar por categoría">
        <button className="catf__btn" aria-pressed={value === 'all'} onClick={() => onChange('all')}>
          <LayoutGrid size={16} /><span>Todas</span>
        </button>
        {cats.map(c => {
          const Ic = catIcon(c.icon)
          return (
            <button key={c.id} className="catf__btn" aria-pressed={value === c.id} onClick={() => onChange(value === c.id ? 'all' : c.id)}>
              <Ic size={16} /><span>{c.name}</span><em className="tnum">{countFor(c.id)}</em>
            </button>
          )
        })}
      </div>
      {edge.r && <button className="catf__arrow catf__arrow--r" onClick={() => go(1)} aria-label="Ver más categorías" tabIndex={-1}><ChevronRight size={18} /></button>}
    </div>
  )
}
