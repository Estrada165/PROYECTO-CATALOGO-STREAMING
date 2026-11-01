import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react'
import Sheet from './Sheet'
import FitImage from './FitImage'

const TAG = { accent: 'Promoción', info: 'Novedad', success: 'Buena noticia', warning: 'Importante' }

// Carrusel de avisos: deslizable, con imagen completa sin recortar
export default function Announcements({ items, open, onClose, onAction, start = 0 }) {
  const [state, setState] = useState({ i: start, dir: 'next' })
  const drag = useRef(null)
  useEffect(() => { if (open) setState({ i: start, dir: 'next' }) }, [open, start])
  if (!items.length) return null
  const i = Math.min(state.i, items.length - 1)
  const a = items[i]
  const go = (n, dir) => setState({ i: (n + items.length) % items.length, dir })

  const onDown = e => { drag.current = { x: e.clientX, y: e.clientY } }
  const onUp = e => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y
    drag.current = null
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(i + (dx < 0 ? 1 : -1), dx < 0 ? 'next' : 'prev')
  }

  const footer = a.cta_kind !== 'none' && a.cta_label ? (
    <button className="key key--accent key--block key--lg" onClick={() => onAction(a)}>{a.cta_label}</button>
  ) : null

  return (
    <Sheet open={open} onClose={onClose} title={items.length > 1 ? `Avisos · ${i + 1} de ${items.length}` : 'Aviso'} footer={footer}>
      <div className="ann" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { drag.current = null }}>
        <section className="ann__slide" key={a.id} data-dir={state.dir} aria-live="polite">
          {a.image_url ? (
            <>
              <FitImage className="fit-img ann__media" src={a.image_url} alt="" />
              <span className="ann__tag" data-tone={a.tone}>{TAG[a.tone] || 'Aviso'}</span>
              <h3 className="ann__title">{a.title}</h3>
            </>
          ) : (
            <div className="ann__plain" data-tone={a.tone}>
              <span className="ann__icon" aria-hidden="true"><Megaphone size={24} /></span>
              <div><span className="ann__tag" data-tone={a.tone}>{TAG[a.tone] || 'Aviso'}</span><h3 className="ann__title">{a.title}</h3></div>
            </div>
          )}
          {a.message && <p className="ann__msg">{a.message}</p>}
        </section>
      </div>
      {items.length > 1 && (
        <div className="ann__nav">
          <button className="key key--icon key--sm" onClick={() => go(i - 1, 'prev')} aria-label="Aviso anterior"><ChevronLeft size={18} /></button>
          <div className="dots">
            {items.map((x, k) => <button key={x.id} aria-label={`Ir al aviso ${k + 1}`} aria-current={k === i} onClick={() => go(k, k < i ? 'prev' : 'next')} />)}
          </div>
          <button className="key key--icon key--sm" onClick={() => go(i + 1, 'next')} aria-label="Aviso siguiente"><ChevronRight size={18} /></button>
        </div>
      )}
    </Sheet>
  )
}
