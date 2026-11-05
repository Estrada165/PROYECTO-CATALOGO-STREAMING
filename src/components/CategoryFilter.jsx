import { LayoutGrid, Tv, Music, Wand2, Radio, Sparkles, Gamepad2, BookOpen, Dumbbell, GraduationCap, Film, Trophy, Shield, Cloud, Palette, Briefcase } from 'lucide-react'

// Íconos que el dueño puede elegir para cada categoría (se guardan por nombre)
export const CAT_ICONS = {
  tv: Tv, music: Music, wand: Wand2, radio: Radio, film: Film, trophy: Trophy, gamepad: Gamepad2,
  book: BookOpen, school: GraduationCap, fitness: Dumbbell, shield: Shield, cloud: Cloud,
  palette: Palette, work: Briefcase, sparkles: Sparkles,
}
export const catIcon = name => CAT_ICONS[name] || Sparkles

// Filtro por categoría: lo arma el dueño en "Duraciones y categorías"
export default function CategoryFilter({ cats, value, onChange, countFor }) {
  return (
    <div className="catf" role="group" aria-label="Filtrar por categoría">
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
  )
}
