import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

let openCount = 0

// Hoja modal: sube desde abajo en móvil; centrada o lateral en escritorio
export default function Sheet({ open, onClose, title, variant = 'center', children, footer, head, labelledBy, wide }) {
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  const panel = useRef(null)
  const lastFocus = useRef(null)

  useEffect(() => {
    if (open) { setMounted(true); setClosing(false) }
    else if (mounted) {
      setClosing(true)
      const t = setTimeout(() => { setMounted(false); setClosing(false) }, 230)
      return () => clearTimeout(t)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mounted || closing) return
    lastFocus.current = document.activeElement
    openCount++
    document.documentElement.style.overflow = 'hidden'
    const onKey = e => {
      if (e.key === 'Escape') onClose?.()
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    requestAnimationFrame(() => panel.current?.focus())
    return () => {
      document.removeEventListener('keydown', onKey)
      openCount = Math.max(0, openCount - 1)
      if (!openCount) document.documentElement.style.overflow = ''
      lastFocus.current?.focus?.({ preventScroll: true })
    }
  }, [mounted, closing]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null
  return createPortal(
    <div className={`sheet-root${closing ? ' is-closing' : ''}${wide ? ' is-wide' : ''}`} data-v={variant}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy || 'sheet-title'} ref={panel} tabIndex={-1}>
        <div className="sheet__grab" aria-hidden="true" />
        <div className="sheet__head">
          {head}
          <h2 className="sheet__title" id={labelledBy || 'sheet-title'}>{title}</h2>
          <button className="key key--icon key--sm" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
