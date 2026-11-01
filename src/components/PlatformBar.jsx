import { useEffect, useRef, useState } from 'react'
import { Search, X, LayoutGrid } from 'lucide-react'

// Barra de plataformas: avanza sola y despacio dentro de una vitrina.
// La lupa permite buscar; al escribir, la barra se detiene y muestra solo las coincidencias.
const short = n => n.split(/ [—+(-]| con /)[0].trim()
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function PlatformBar({ items, selected, onPick, onClear }) {
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState('')
  const input = useRef(null)
  const sel = items.find(p => p.id === selected)
  const found = q ? items.filter(p => norm(`${p.name} ${(p.tags || []).join(' ')}`).includes(norm(q))) : items
  const still = searching && q
  const loop = still ? found : [...items, ...items]
  useEffect(() => { if (searching) input.current?.focus() }, [searching])
  const close = () => { setSearching(false); setQ('') }
  const pick = id => { onPick(id); close() }

  return (
    <div className={`pbox${selected ? ' has-sel' : ''}${searching ? ' is-search' : ''}`}>
      <div className="pbox__side">
        {searching ? (
          <div className="pbox__search">
            <Search size={16} />
            <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar plataforma" aria-label="Buscar plataforma"
              onKeyDown={e => { if (e.key === 'Escape') close(); if (e.key === 'Enter' && found[0]) pick(found[0].id) }} />
            <button onClick={close} aria-label="Cerrar búsqueda"><X size={15} /></button>
          </div>
        ) : sel ? (
          <button className="pbox__sel" onClick={onClear} aria-label={`Quitar filtro ${sel.name}`}>
            <img src={sel.logo_url} alt="" width="26" height="26" /><span>{short(sel.name)}</span><X size={14} />
          </button>
        ) : (
          <>
            <span className="pbox__label"><LayoutGrid size={15} /><b>Plataformas</b><em className="tnum">{items.length}</em></span>
            <button className="pbox__lupa" onClick={() => setSearching(true)} aria-label="Buscar plataforma"><Search size={16} /><span>Buscar</span></button>
          </>
        )}
      </div>
      <div className={`pbar${selected || searching ? ' is-paused' : ''}${still ? ' is-still' : ''}`} role="group" aria-label="Filtrar por plataforma">
        {still && !found.length ? <p className="pbar__none">Ninguna plataforma con “{q}”.</p> : (
          <div className="pbar__track" style={{ '--n': items.length }}>
            {loop.map((p, i) => {
              const dup = !still && i >= items.length
              return (
                <button key={`${p.id}-${i}`} className="pbar__item" aria-pressed={selected === p.id} aria-hidden={dup || undefined} tabIndex={dup ? -1 : 0}
                  onClick={() => pick(p.id)} title={p.name}>
                  <span className="pbar__logo"><img src={p.logo_url} alt="" width="44" height="44" loading="lazy" /></span>
                  <span className="pbar__name">{short(p.name)}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
