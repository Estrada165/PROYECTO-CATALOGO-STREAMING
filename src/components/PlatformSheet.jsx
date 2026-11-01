import { useEffect, useState } from 'react'
import { Check, AlertTriangle, Plus, MessageCircle } from 'lucide-react'
import Sheet from './Sheet'
import FitImage from './FitImage'
import { priceFor } from '../lib/catalog'
import { money } from '../lib/format'

export default function PlatformSheet({ p, idx, optionId, sym, onClose, onAdd, onConsult }) {
  const priced = p ? idx.options.filter(o => priceFor(p, o.id) != null) : []
  const [sel, setSel] = useState(optionId)
  useEffect(() => {
    if (!p) return
    setSel(priced.some(o => o.id === optionId) ? optionId : priced[0]?.id)
  }, [p?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return <Sheet open={false} onClose={onClose} />
  const consult = p.pricing_mode === 'consult'
  const fixed = p.pricing_mode === 'fixed'
  const cat = idx.catById[p.category_id]

  const footer = consult ? (
    <button className="key key--wa key--block key--lg" onClick={() => onConsult(p)}>
      <MessageCircle size={18} /> Consultar por WhatsApp
    </button>
  ) : (
    <button className="key key--accent key--block key--lg" disabled={p.stock === 'out' || (!fixed && !sel)}
      onClick={e => onAdd(p, e.currentTarget, fixed ? null : sel)}>
      <Plus size={18} strokeWidth={2.6} />
      {p.stock === 'out' ? 'Agotado' : `Agregar · ${money(priceFor(p, sel), sym)}`}
    </button>
  )

  return (
    <Sheet open={!!p} onClose={onClose} title={p.name} footer={footer}
      head={<img className="detail__logo" src={p.logo_url} alt="" width="64" height="64" />}>
      {cat && <div className="tags"><span>{cat.name}</span></div>}
      {p.description && <p className="detail__desc">{p.description}</p>}

      {fixed && (
        <div className="opt-list">
          <div className="opt" aria-pressed="true">
            <span className="opt__txt"><b>Precio único</b>{p.fixed_note && <small>{p.fixed_note}</small>}</span>
            <span className="opt__price tnum">{money(p.fixed_price, sym)}</span>
          </div>
        </div>
      )}
      {consult && p.consult_note && <div className="note block"><p>{p.consult_note}</p></div>}
      {!fixed && !consult && (
        <div className="opt-list" role="group" aria-label="Elige tu plan">
          {priced.map(o => {
            const row = p.prices.find(r => r.option_id === o.id)
            return (
              <button key={o.id} className="opt" aria-pressed={sel === o.id} onClick={() => setSel(o.id)}>
                <span className="opt__radio" aria-hidden="true" />
                <span className="opt__txt"><b>{o.label} · {o.period}</b>{row?.note && <small>{row.note}</small>}</span>
                <span className="opt__price tnum">{money(row?.price, sym)}</span>
              </button>
            )
          })}
        </div>
      )}

      {p.features?.length > 0 && (
        <div className="block"><h4>Incluye</h4>
          <ul className="ticks">{p.features.map(f => <li key={f}><Check size={16} strokeWidth={2.6} />{f}</li>)}</ul>
        </div>
      )}
      {p.restrictions?.length > 0 && (
        <div className="block"><h4>Ten en cuenta</h4>
          <ul className="ticks is-warn">{p.restrictions.map(f => <li key={f}><AlertTriangle size={15} />{f}</li>)}</ul>
        </div>
      )}
      {(p.extra_sections || []).map((s, i) => (
        <div className="block" key={i}>
          <h4>{s.title}</h4>
          {s.kind === 'steps' && <ol className="nums">{s.items.map((t, j) => <li key={j}>{t}</li>)}</ol>}
          {s.kind === 'list' && <ul className="ticks">{s.items.map((t, j) => <li key={j}><Check size={16} strokeWidth={2.6} />{t}</li>)}</ul>}
          {s.kind === 'note' && <div className="note">{s.items.map((t, j) => <p key={j}>{t}</p>)}</div>}
          {s.kind === 'image' && s.image_url && <FitImage src={s.image_url} alt={s.title} />}
        </div>
      ))}
      {p.popular_content?.length > 0 && (
        <div className="block"><h4>Para ver</h4>
          <div className="tags">{p.popular_content.slice(0, 8).map(t => <span key={t}>{t}</span>)}</div>
        </div>
      )}
    </Sheet>
  )
}
