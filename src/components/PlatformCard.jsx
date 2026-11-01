import { useEffect, useState } from 'react'
import { Minus, Plus, MessageCircle, ChevronRight } from 'lucide-react'
import { priceFor } from '../lib/catalog'
import { money } from '../lib/format'
import { logoTint } from '../lib/tint'

const BADGE = { popular: 'Popular', nuevo: 'Nuevo', oferta: 'Oferta', limitado: 'Últimos' }

export default function PlatformCard({ p, optionId, option, qty, sym, onOpen, onAdd, onDec, onConsult, index }) {
  const price = priceFor(p, optionId)
  const out = p.stock === 'out'
  const consult = p.pricing_mode === 'consult'
  const fixed = p.pricing_mode === 'fixed'
  const [tint, setTint] = useState(null)
  useEffect(() => { let on = true; logoTint(p.logo_url).then(t => on && setTint(t)); return () => { on = false } }, [p.logo_url])

  return (
    <article className={`p-card${qty ? ' in-cart' : ''}${out ? ' is-out' : ''}`} style={{ '--i': Math.min(index, 18), ...(tint ? { '--tint': tint } : {}) }}>
      <span className="p-card__glow" aria-hidden="true" />
      {p.badge && <span className="p-card__badge" data-b={p.badge}>{BADGE[p.badge]}</span>}
      {out && <span className="p-card__stock">Agotado</span>}
      <button className="p-card__face" onClick={() => onOpen(p)} aria-label={`Ver detalles de ${p.name}`}>
        <span className="p-card__logo">
          {p.logo_url
            ? <img src={p.logo_url} alt="" loading="lazy" decoding="async" width="72" height="72" />
            : <b style={{ fontSize: 26 }}>{p.name.slice(0, 1)}</b>}
        </span>
        <span className="p-card__name">{p.name}</span>
        <span className="p-card__pricebox">
          {consult
            ? <span className="p-card__price is-consult">Consultar</span>
            : <span className="p-card__price tnum">{money(price, sym)}</span>}
          <small className="p-card__per">{consult ? 'precio según disponibilidad' : fixed ? 'pago único' : option ? `${option.label.toLowerCase()} · ${option.period}` : ''}</small>
        </span>
        <span className="p-card__more">Ver detalles <ChevronRight size={13} /></span>
      </button>
      <div className="p-card__foot">
        {consult ? (
          <button className="key key--block key--sm" onClick={() => onConsult(p)}>
            <MessageCircle size={16} /> Consultar
          </button>
        ) : qty > 0 ? (
          <div className="stepper" role="group" aria-label={`Cantidad de ${p.name}`}>
            <button onClick={onDec} aria-label="Quitar uno"><Minus size={18} /></button>
            <output className="tnum" aria-live="polite">{qty}</output>
            <button onClick={e => onAdd(p, e.currentTarget)} aria-label="Agregar uno"><Plus size={18} /></button>
          </div>
        ) : (
          <button className="key key--accent key--block" disabled={out} onClick={e => onAdd(p, e.currentTarget)}>
            <Plus size={17} strokeWidth={2.6} /> {out ? 'Agotado' : 'Agregar'}
          </button>
        )}
      </div>
    </article>
  )
}
