import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

// Ícono (i) con una burbuja explicativa. Se cierra al tocar fuera o con Escape.
export default function InfoTip({ label, children, action }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btn = useRef(null), bubble = useRef(null)
  const id = useId()

  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const place = () => {
      const r = btn.current.getBoundingClientRect()
      const w = Math.min(300, innerWidth - 24)
      const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), innerWidth - w - 12)
      const below = r.bottom + 10 + 180 < innerHeight
      setPos({ left, width: w, top: below ? r.bottom + 10 : undefined, bottom: below ? undefined : innerHeight - r.top + 10, arrow: r.left + r.width / 2 - left })
    }
    place()
    addEventListener('resize', place); addEventListener('scroll', place, true)
    return () => { removeEventListener('resize', place); removeEventListener('scroll', place, true) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const out = e => { if (!bubble.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false) }
    const esc = e => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus() } }
    document.addEventListener('pointerdown', out); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', esc) }
  }, [open])

  return (
    <>
      <button ref={btn} type="button" className="info-btn" aria-label={`Más información: ${label}`}
        aria-expanded={open} aria-controls={id} onClick={e => { e.stopPropagation(); setOpen(o => !o) }}>
        <Info size={15} strokeWidth={2.4} />
      </button>
      {open && pos && createPortal(
        <div ref={bubble} id={id} role="tooltip" className={`info-bubble${pos.top === undefined ? ' is-up' : ''}`}
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, '--arrow': `${pos.arrow}px` }}>
          <b>{label}</b>
          <div>{children}</div>
          {action && <div className="info-bubble__act" onClick={() => setOpen(false)}>{action}</div>}
        </div>,
        document.body,
      )}
    </>
  )
}

