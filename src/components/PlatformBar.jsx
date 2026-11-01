import { X } from 'lucide-react'

// Barra animada de plataformas: avanza sola y despacio; se detiene al pasar el mouse,
// al tocarla o al elegir una. Tocar una plataforma muestra solo esa (todas sus opciones).
const short = n => n.split(/ [—+(-]| con /)[0].trim()

export default function PlatformBar({ items, selected, onPick, onClear }) {
  const loop = [...items, ...items]
  const sel = items.find(p => p.id === selected)
  return (
    <div className={`pbar-wrap${selected ? ' has-sel' : ''}`}>
      {sel && (
        <button className="pbar-clear" onClick={onClear} aria-label={`Quitar filtro ${sel.name}`}>
          <img src={sel.logo_url} alt="" width="22" height="22" /><span>{short(sel.name)}</span><X size={15} />
        </button>
      )}
      <div className={`pbar${selected ? ' is-paused' : ''}`} role="group" aria-label="Filtrar por plataforma">
        <div className="pbar__track" style={{ '--n': items.length }}>
          {loop.map((p, i) => {
            const dup = i >= items.length
            return (
              <button key={`${p.id}-${i}`} className="pbar__item" aria-pressed={selected === p.id} aria-hidden={dup || undefined} tabIndex={dup ? -1 : 0}
                onClick={() => onPick(p.id)} title={p.name}>
                <span className="pbar__logo"><img src={p.logo_url} alt="" width="44" height="44" loading="lazy" /></span>
                <span className="pbar__name">{short(p.name)}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
