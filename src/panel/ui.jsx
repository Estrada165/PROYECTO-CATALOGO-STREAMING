import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ImagePlus, Loader2, Plus, Trash2, X, AlertTriangle } from 'lucide-react'
import Sheet from '../components/Sheet'
import { uploadImage, niceError } from './api'

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function Field({ label, hint, error, children, wide, htmlFor }) {
  return (
    <div className={`pf${wide ? ' pf--wide' : ''}${error ? ' has-error' : ''}`}>
      {label && <label className="pf__label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <p className="pf__error" role="alert">{error}</p> : hint && <p className="pf__hint">{hint}</p>}
    </div>
  )
}

export function Text({ label, hint, error, value, onChange, wide, max, ...rest }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} error={error} wide={wide} htmlFor={id}>
      <input id={id} className="pin" value={value ?? ''} maxLength={max} onChange={e => onChange(e.target.value)} {...rest} />
    </Field>
  )
}

export function Area({ label, hint, value, onChange, wide = true, rows = 3, max, ...rest }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} wide={wide} htmlFor={id}>
      <textarea id={id} className="pin pin--area" rows={rows} maxLength={max} value={value ?? ''} onChange={e => onChange(e.target.value)} {...rest} />
      {max && <span className="pf__count tnum">{String(value || '').length}/{max}</span>}
    </Field>
  )
}

export function Money({ label, hint, value, onChange, sym = 'S/', placeholder = '0.00', ...rest }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <div className="pin-money"><span>{sym}</span>
        <input id={id} className="pin tnum" inputMode="decimal" value={value ?? ''} placeholder={placeholder}
          onChange={e => onChange(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))} {...rest} />
      </div>
    </Field>
  )
}

// Menú desplegable propio (se ve igual en claro y oscuro, con teclado)
export function Dropdown({ value, onChange, options, id, label, className = '', disabled, compact, renderValue }) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const [pos, setPos] = useState(null)
  const btn = useRef(null), list = useRef(null)
  const cur = options.find(o => String(o.value) === String(value ?? ''))
  const place = () => {
    const r = btn.current.getBoundingClientRect()
    const h = Math.min(320, options.length * 40 + 12)
    const up = r.bottom + h + 8 > innerHeight && r.top > h + 8
    const w = Math.max(r.width, compact ? 150 : 0)
    setPos({ left: Math.min(r.left, innerWidth - w - 8), width: w, top: up ? undefined : r.bottom + 6, bottom: up ? innerHeight - r.top + 6 : undefined, max: h })
  }
  const openIt = () => { if (disabled) return; place(); setHi(Math.max(0, options.findIndex(o => String(o.value) === String(value ?? '')))); setOpen(true) }
  const pick = o => { onChange(o.value); setOpen(false); btn.current?.focus() }
  useEffect(() => {
    if (!open) return
    const out = e => { if (!list.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false) }
    const re = () => place()
    document.addEventListener('pointerdown', out); addEventListener('resize', re); addEventListener('scroll', re, true)
    requestAnimationFrame(() => list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }))
    return () => { document.removeEventListener('pointerdown', out); removeEventListener('resize', re); removeEventListener('scroll', re, true) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const key = e => {
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openIt(); return }
    if (!open) return
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, options.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); options[hi] && pick(options[hi]) }
    if (e.key === 'Tab') setOpen(false)
  }
  useEffect(() => { if (open) list.current?.children[hi]?.scrollIntoView({ block: 'nearest' }) }, [hi, open])
  return (
    <>
      <button type="button" id={id} ref={btn} className={`pdrop ${className}`} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={label}
        onClick={() => (open ? setOpen(false) : openIt())} onKeyDown={key}>
        {renderValue ? renderValue(cur) : <span className="pdrop__val">{cur?.label ?? '—'}</span>}
        {!compact && <svg className="pdrop__chev" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </button>
      {open && pos && createPortal(
        <ul ref={list} role="listbox" className="pdrop__list" style={{ left: pos.left, minWidth: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.max }} onKeyDown={key}>
          {options.map((o, i) => (
            <li key={String(o.value)} role="option" aria-selected={String(o.value) === String(value ?? '')} className={i === hi ? 'is-hi' : ''}
              onPointerEnter={() => setHi(i)} onClick={() => pick(o)}>
              <span>{o.label}</span>{String(o.value) === String(value ?? '') && <Check size={15} />}
            </li>
          ))}
        </ul>, document.body)}
    </>
  )
}

export function Select({ label, hint, value, onChange, options, wide, disabled }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} wide={wide} htmlFor={id}>
      <Dropdown id={id} value={value} onChange={onChange} options={options} disabled={disabled} label={label} />
    </Field>
  )
}

export function Toggle({ label, hint, checked, onChange, disabled }) {
  return (
    <label className={`ptoggle${disabled ? ' is-disabled' : ''}`}>
      <span className="ptoggle__txt"><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <input type="checkbox" role="switch" checked={!!checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span className="ptoggle__ui" aria-hidden="true" />
    </label>
  )
}

// Opciones visuales tipo "tarjeta" (estilo, tono, forma…)
export function Choice({ label, value, onChange, options, cols = 3 }) {
  return (
    <Field label={label} wide>
      <div className="pchoice" style={{ '--cols': cols }} role="radiogroup" aria-label={label}>
        {options.map(o => (
          <button type="button" key={o.value} role="radio" aria-checked={value === o.value} className="pchoice__opt" onClick={() => onChange(o.value)}>
            {o.preview}
            <b>{o.label}</b>{o.hint && <small>{o.hint}</small>}
          </button>
        ))}
      </div>
    </Field>
  )
}

// Lista de textos con autocompletado (características, restricciones, etiquetas…)
export function ListEditor({ label, hint, items = [], onChange, suggestions = [], placeholder = 'Escribe y presiona Enter', chips = false, max = 30 }) {
  const [text, setText] = useState('')
  const [hi, setHi] = useState(0)
  const id = useId()
  const sugg = useMemo(() => {
    const w = norm(text).trim()
    if (w.length < 2) return []
    const have = new Set(items.map(norm))
    return [...new Set(suggestions)].filter(s => !have.has(norm(s)) && norm(s).includes(w)).slice(0, 6)
  }, [text, suggestions, items])
  const add = v => {
    const t = String(v || '').trim()
    if (!t || items.length >= max || items.some(x => norm(x) === norm(t))) { setText(''); return }
    onChange([...items, t]); setText(''); setHi(0)
  }
  const move = (i, d) => onChange(moveItem(items, i, d))
  return (
    <Field label={label} hint={hint} wide htmlFor={id}>
      {items.length > 0 && (chips ? (
        <div className="pchips">{items.map((x, i) => (
          <span key={x + i} className="pchip">{x}<button type="button" onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label={`Quitar ${x}`}><X size={13} /></button></span>
        ))}</div>
      ) : (
        <ul className="plist">{items.map((x, i) => (
          <li key={x + i}>
            <OrderButtons index={i} total={items.length} onMove={move} />
            <input className="plist__in" value={x} aria-label={`Elemento ${i + 1}`} onChange={e => { const a = [...items]; a[i] = e.target.value; onChange(a) }} onBlur={() => onChange(items.filter(v => v.trim()))} />
            <span className="plist__acts">
              <button type="button" onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label="Quitar"><Trash2 size={14} /></button>
            </span>
          </li>
        ))}</ul>
      ))}
      <div className="pauto">
        <div className="pauto__row">
          <input id={id} className="pin" value={text} placeholder={placeholder} autoComplete="off"
            role="combobox" aria-expanded={sugg.length > 0} aria-autocomplete="list"
            onChange={e => { setText(e.target.value); setHi(0) }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); add(sugg.length && hi >= 0 && text.trim() !== sugg[hi] && norm(sugg[hi]).startsWith(norm(text)) ? sugg[hi] : text) }
              if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, sugg.length - 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)) }
            }} />
          <button type="button" className="key key--icon" onClick={() => add(text)} aria-label="Agregar" disabled={!text.trim()}><Plus size={18} /></button>
        </div>
        {sugg.length > 0 && (
          <ul className="pauto__list" role="listbox">
            {sugg.map((s, i) => (
              <li key={s} role="option" aria-selected={i === hi}>
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => add(s)}>{s}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  )
}

// Subida de imagen con vista previa; se convierte a WebP
export function ImageInput({ label, hint, value, onChange, tid, kind = 'img', max = 512, shape = 'square', canEdit = true }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const input = useRef(null)
  const pick = async f => {
    if (!f) return
    setBusy(true); setErr(null)
    try { onChange(await uploadImage(tid, f, kind, max)) } catch (e) { setErr(niceError(e)) } finally { setBusy(false) }
  }
  return (
    <Field label={label} hint={hint} error={err} wide>
      <div className={`pimg pimg--${shape}`}
        onDragOver={e => { e.preventDefault() }} onDrop={e => { e.preventDefault(); canEdit && pick(e.dataTransfer.files?.[0]) }}>
        <button type="button" className="pimg__box" onClick={() => input.current?.click()} disabled={!canEdit || busy} aria-label={value ? 'Cambiar imagen' : 'Subir imagen'}>
          {busy ? <Loader2 className="spin" size={22} /> : value ? <img src={value} alt="" /> : <ImagePlus size={22} />}
        </button>
        <div className="pimg__txt">
          <b>{value ? 'Imagen lista' : 'Sube una imagen'}</b>
          <small>PNG, JPG o WebP. Se optimiza sola. También puedes arrastrarla aquí.</small>
          <div className="pimg__acts">
            <button type="button" className="key key--sm" onClick={() => input.current?.click()} disabled={!canEdit || busy}>{value ? 'Cambiar' : 'Elegir archivo'}</button>
            {value && <button type="button" className="key key--sm key--ghost" onClick={() => onChange(null)} disabled={!canEdit}>Quitar</button>}
          </div>
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
      </div>
    </Field>
  )
}

// Barra para guardar: aparece cuando hay cambios
export function SaveBar({ dirty, saving, onSave, onReset, canEdit = true, label = 'Guardar cambios' }) {
  useEffect(() => {
    if (!dirty) return
    const k = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (canEdit && !saving) onSave() } }
    const leave = e => { e.preventDefault(); e.returnValue = '' }
    addEventListener('keydown', k); addEventListener('beforeunload', leave)
    return () => { removeEventListener('keydown', k); removeEventListener('beforeunload', leave) }
  }, [dirty, saving, onSave, canEdit])
  return (
    <div className={`psave${dirty ? ' is-on' : ''}`} aria-hidden={!dirty}>
      <span><span className="psave__dot" />Tienes cambios sin guardar</span>
      <div className="psave__acts">
        {onReset && <button className="key key--sm key--ghost" onClick={onReset} disabled={saving} tabIndex={dirty ? 0 : -1}>Descartar</button>}
        <button className="key key--accent key--sm" onClick={onSave} disabled={saving || !canEdit} tabIndex={dirty ? 0 : -1}>
          {saving ? <Loader2 className="spin" size={15} /> : <Check size={15} />} {label}
        </button>
      </div>
    </div>
  )
}

export function Confirm({ open, title, text, danger = true, confirmLabel = 'Eliminar', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  return (
    <Sheet open={open} onClose={onClose} title={title}
      footer={<div className="row-2 row-2--eq">
        <button className="key key--lg" onClick={onClose}>Cancelar</button>
        <button className={`key key--lg ${danger ? 'key--danger' : 'key--accent'}`} disabled={busy}
          onClick={async () => { setBusy(true); try { await onConfirm() } finally { setBusy(false) } }}>
          {busy ? <Loader2 className="spin" size={16} /> : danger && <Trash2 size={16} />} {confirmLabel}
        </button>
      </div>}>
      <p className="pmuted">{text}</p>
    </Sheet>
  )
}

export function Banner({ tone = 'info', icon, children, action }) {
  return (
    <div className={`pbanner pbanner--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      {icon || <AlertTriangle size={18} />}<div>{children}</div>{action}
    </div>
  )
}

export function Empty({ icon, title, text, action }) {
  return (
    <div className="pempty">
      {icon && <span className="pempty__ic">{icon}</span>}
      <b>{title}</b>{text && <p>{text}</p>}{action}
    </div>
  )
}

// Posición en la lista. El número se toca para elegir la posición, o se mantiene
// presionado y se arrastra sobre otra fila: las dos filas intercambian su lugar.
export function OrderButtons({ index, total, onMove, disabled, label = 'Posición' }) {
  const ref = useRef(null)
  const startDrag = e => {
    if (disabled || total < 2 || e.button > 0) return
    const li = ref.current.closest('li'); const ul = li?.parentElement
    if (!li || !ul) return
    const sx = e.clientX, sy = e.clientY
    let started = false, target = null
    const timer = setTimeout(() => begin(), e.pointerType === 'mouse' ? 120 : 260)
    const rows = () => [...ul.children]
    function begin() {
      started = true; li.classList.add('is-dragging'); document.body.classList.add('pdragging')
      try { navigator.vibrate?.(12) } catch { /* sin vibración */ }
    }
    const move = ev => {
      if (!started) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) { clearTimeout(timer); if (e.pointerType === 'mouse') begin(); else return end() } else return }
      ev.preventDefault()
      li.style.transform = `translate(${(ev.clientX - sx) * 0.15}px, ${ev.clientY - sy}px) scale(1.02)`
      const over = rows().find(r => { if (r === li) return false; const b = r.getBoundingClientRect(); return ev.clientY > b.top && ev.clientY < b.bottom })
      if (over !== target) { target?.classList.remove('is-target'); target = over; target?.classList.add('is-target') }
    }
    const end = () => {
      clearTimeout(timer)
      removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end)
      li.classList.remove('is-dragging'); li.style.transform = ''; document.body.classList.remove('pdragging')
      if (started) addEventListener('click', ev => { ev.stopPropagation(); ev.preventDefault() }, { capture: true, once: true })
      if (started && target) { const to = rows().indexOf(target); target.classList.remove('is-target'); if (to >= 0) onMove(index, to - index) }
    }
    addEventListener('pointermove', move, { passive: false }); addEventListener('pointerup', end); addEventListener('pointercancel', end)
  }
  return (
    <span ref={ref} className={`pnum${disabled ? ' is-disabled' : ''}`} onPointerDown={startDrag} title="Toca para elegir la posición o mantén presionado y arrastra">
      <Dropdown compact value={index} disabled={disabled || total < 2} label={`${label} ${index + 1} de ${total}. Cambiar posición`}
        onChange={v => onMove(index, Number(v) - index)}
        renderValue={() => <b className="tnum">{index + 1}</b>}
        options={Array.from({ length: total }, (_, i) => ({ value: i, label: i === 0 ? '1 · primero' : i === total - 1 ? `${i + 1} · último` : `Posición ${i + 1}` }))} />
    </span>
  )
}

// Intercambia dos elementos (el resto no se mueve)
export const moveItem = (arr, i, d) => {
  const j = i + d
  if (!d || j < 0 || j >= arr.length) return arr
  const a = [...arr]; [a[i], a[j]] = [a[j], a[i]]
  return a
}

export { norm }

// Tres pasos cortos que explican cómo funciona una sección
export function Explain({ steps }) {
  return (
    <div className="pexplain">
      {steps.map(([t, d], i) => <div key={i}><em className="tnum">{i + 1}</em><span><b>{t}</b>{d}</span></div>)}
    </div>
  )
}
