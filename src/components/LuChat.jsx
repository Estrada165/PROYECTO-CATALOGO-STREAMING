import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, Plus, ShoppingBag, MessageCircle, Sparkles, RotateCcw, ChevronRight } from 'lucide-react'
import { getSupabase } from '../lib/supabase'
import { priceFor } from '../lib/catalog'
import { money, store, session } from '../lib/format'
import { waLink } from '../lib/cart'

const MARK = /\[\[(p|c):([0-9a-f-]{36})\]\]|\[\[(carrito|whatsapp)\]\]|\[\[img:((?:https?:\/\/|\/)[^\]\s]+)\]\]/gi

function visitorId() {
  let v = store.get('cs-visitor')
  if (!v || !/^[A-Za-z0-9_-]{8,64}$/.test(v)) { v = (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now()).replace(/[^A-Za-z0-9]/g, '').slice(0, 32); store.set('cs-visitor', v) }
  return v
}

// Separa el texto de los marcadores que pone Lu ([[p:ID]], [[carrito]]…)
function parse(text) {
  const items = []; let m
  MARK.lastIndex = 0
  while ((m = MARK.exec(text))) items.push(m[1] ? { kind: m[1].toLowerCase(), id: m[2] } : m[4] ? { kind: 'img', id: m[4] } : { kind: m[3].toLowerCase() })
  const clean = text.replace(MARK, '').replace(/[ \t]+([.,!?;:])/g, '$1').replace(/\*\*(.+?)\*\*/g, '$1').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim()
  const seen = new Set()
  return { clean, items: items.filter(x => { const k = x.kind + (x.id || ''); if (seen.has(k)) return false; seen.add(k); return true }) }
}

export default function LuChat({ cat, slug, idx, optionId, sym, onAdd, onAddCombo, onOpenCart, onOpen, waHref, waNumber, hidden, forceClose }) {
  const bot = cat.bot
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState(() => { try { return JSON.parse(session.get(`cs-lu:${slug}`) || '[]') } catch { return [] } })
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  // Cupo diario por visitante (lo decide el servidor; aquí solo se muestra)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())
  const [quota, setQuota] = useState(() => { const q = store.get(`cs-lu-quota:${slug}`); return q?.day === today ? q : null })
  useEffect(() => { if (quota) store.set(`cs-lu-quota:${slug}`, quota) }, [quota, slug])
  const blocked = quota?.blocked && quota.day === today
  const list = useRef(null), input = useRef(null)
  const name = bot?.name || 'Lu'
  const greeting = bot?.greeting || `¡Hola! Soy ${name} 👋 Te ayudo a elegir tu plataforma, armar un combo o resolver dudas de pago.`
  const combosById = useMemo(() => Object.fromEntries((cat.combos || []).map(c => [c.id, c])), [cat.combos])
  const ideas = ['¿Qué me recomiendas para ver series?', '¿Qué combos tienen?', '¿Cómo pago y cuánto demora?', 'Quiero ver fútbol']

  useEffect(() => { session.set(`cs-lu:${slug}`, JSON.stringify(msgs.slice(-20))) }, [msgs, slug])
  useEffect(() => { if (open) requestAnimationFrame(() => list.current?.scrollTo({ top: 1e6, behavior: 'smooth' })) }, [msgs, open, busy])
  // Si se abre el carrito, el chat se cierra para no taparlo
  useEffect(() => { if (forceClose) setOpen(false) }, [forceClose])
  const [zoom, setZoom] = useState(null)
  useEffect(() => {
    const on = () => setOpen(true)
    addEventListener('cs:open-bot', on)
    return () => removeEventListener('cs:open-bot', on)
  }, [])
  // En escritorio el catálogo se corre a la izquierda para dejar espacio al chat
  useEffect(() => {
    document.documentElement.classList.toggle('lu-open', open)
    if (open) setTimeout(() => input.current?.focus(), 250)
    const esc = e => { if (e.key === 'Escape' && !document.querySelector('.sheet-root')) setOpen(false) } // si hay un detalle abierto, Escape solo cierra el detalle
    if (open) addEventListener('keydown', esc)
    return () => removeEventListener('keydown', esc)
  }, [open])

  if (!bot?.live) return null

  const send = async t => {
    const q = (t ?? text).trim()
    if (!q || busy || blocked) return
    const next = [...msgs, { role: 'user', text: q }]
    setMsgs(next); setText(''); setBusy(true)
    try {
      const sb = await getSupabase()
      const { data, error } = await sb.functions.invoke('lu', { body: { slug, visitor: visitorId(), messages: next.map(m => ({ role: m.role, text: m.text })) } })
      if (error) throw error
      setMsgs(m => [...m, { role: 'model', text: data?.reply || data?.error || 'No pude responder ahora.', web: !!data?.web, sources: data?.sources || [] }])
      if (data?.limited === 'visitor') setQuota({ day: today, blocked: true })
      else if (typeof data?.left === 'number') setQuota({ day: today, left: data.left })
    } catch {
      setMsgs(m => [...m, { role: 'model', text: 'No me pude conectar. Revisa tu internet o escríbenos por WhatsApp. [[whatsapp]]', err: true }])
    } finally { setBusy(false) }
  }

  // Mensaje para WhatsApp con el contexto de la conversación (sin depender de la IA)
  const waFor = () => {
    const q = [...msgs].reverse().find(m => m.role === 'user')?.text?.trim()
    if (!waNumber || !q) return waHref
    const txt = `Hola 👋 Vengo del catálogo de ${cat.settings.business_name}. Le pregunté a ${name}: “${q.slice(0, 200)}”. ¿Me ayudan, por favor? 🙌`
    return waLink(waNumber, txt)
  }
  const attach = it => {
    if (it.kind === 'p') {
      const p = idx.byId[it.id]; if (!p) return null
      // Todas las duraciones de la plataforma, sin depender de la pestaña elegida en el catálogo
      const rows = p.pricing_mode === 'options'
        ? idx.options.filter(o => priceFor(p, o.id) != null).map(o => ({ id: o.id, label: `${o.label} · ${o.period}`, price: priceFor(p, o.id) }))
        : p.pricing_mode === 'fixed' ? [{ id: null, label: 'Pago único', price: priceFor(p, null) }] : []
      const out = p.stock === 'out'
      return (
        <div className="lu-card lu-card--p" key={`p${it.id}`}>
          <button className="lu-card__head" onClick={() => onOpen(p)} aria-label={`Ver detalles de ${p.name}`}>
            <img src={p.logo_url} alt="" width="40" height="40" />
            <span><b>{p.name}</b><small>{out ? 'Agotado por ahora' : 'Ver detalles'} <ChevronRight size={12} /></small></span>
          </button>
          {p.pricing_mode === 'consult' ? (
            <div className="lu-opt"><span>Precio según disponibilidad</span>{waHref && <a className="key key--sm key--wa" href={waFor()} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> Consultar</a>}</div>
          ) : rows.map(o => (
            <div className="lu-opt" key={o.id || 'u'}>
              <span>{o.label}</span><b className="tnum">{money(o.price, sym)}</b>
              <button className="key key--accent key--sm" disabled={out} onClick={e => onAdd(p, e.currentTarget, o.id)} aria-label={`Agregar ${p.name}, ${o.label}`}><Plus size={15} /></button>
            </div>
          ))}
        </div>
      )
    }
    if (it.kind === 'c') {
      const c = combosById[it.id]; if (!c) return null
      return (
        <div className="lu-card" key={`c${it.id}`}>
          <span className="lu-card__stack">{c.platform_ids.slice(0, 3).map(id => idx.byId[id] && <img key={id} src={idx.byId[id].logo_url} alt="" width="26" height="26" />)}</span>
          <div><b>{c.name}</b><small className="tnum">{c.custom_price != null ? money(c.custom_price, sym) : 'Combo'}</small></div>
          <button className="key key--accent key--sm" onClick={e => onAddCombo(c, e.currentTarget)} aria-label={`Agregar ${c.name}`}><Plus size={15} /></button>
        </div>
      )
    }
    if (it.kind === 'img') return (
      <button key={`i${it.id}`} className="lu-img" onClick={() => setZoom(it.id)} aria-label="Ampliar imagen"><img src={it.id} alt="" loading="lazy" /></button>
    )
    if (it.kind === 'carrito') return <button key="cart" className="key key--sm lu-act" onClick={() => { setOpen(false); onOpenCart() }}><ShoppingBag size={15} /> Ver mi carrito</button>
    if (it.kind === 'whatsapp' && waHref) return <a key="wa" className="key key--sm key--wa lu-act" href={waFor()} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Escribir por WhatsApp</a>
    return null
  }

  const avatar = bot.avatar_url ? <img src={bot.avatar_url} alt="" /> : <span>{name.slice(0, 1)}</span>

  return createPortal(
    <>
      {!hidden && !open && (
        <button className="lu-fab" onClick={() => setOpen(true)} aria-label={`Preguntarle a ${name}`}>
          <span className="lu-fab__av">{avatar}</span><span className="lu-fab__txt">Pregúntale a {name}</span>
        </button>
      )}
      <section className={`lu${open ? ' is-open' : ''}`} role="dialog" aria-modal="false" aria-label={`Chat con ${name}`} aria-hidden={!open}>
        <header className="lu__head">
          <span className="lu__av">{avatar}<i aria-hidden="true" /></span>
          <div><b>{name}</b><small>Asistente de {cat.settings.business_name} · responde al instante</small></div>
          {msgs.length > 0 && <button className="key key--icon key--sm key--ghost" onClick={() => setMsgs([])} aria-label="Nueva conversación" title="Nueva conversación"><RotateCcw size={16} /></button>}
          <button className="key key--icon key--sm" onClick={() => setOpen(false)} aria-label="Cerrar chat"><X size={18} /></button>
        </header>
        <div className="lu__body" ref={list} aria-live="polite">
          <div className="lu-msg is-bot"><p>{greeting}</p></div>
          {msgs.length === 0 && (
            <div className="lu-ideas">{ideas.map(i => <button key={i} onClick={() => send(i)}><Sparkles size={13} /> {i}</button>)}</div>
          )}
          {msgs.map((m, i) => {
            if (m.role === 'user') return <div key={i} className="lu-msg is-me"><p>{m.text}</p></div>
            const { clean, items } = parse(m.text)
            return (
              <div key={i} className="lu-msg is-bot">
                {clean && <p>{clean}</p>}
                {items.length > 0 && <div className="lu-att">{items.map(attach)}</div>}
                {(() => {
                  // Si recomienda varias, se agregan todas de un toque
                  const optFor = p => p.pricing_mode !== 'options' ? null : priceFor(p, optionId) != null ? optionId : idx.options.find(o => priceFor(p, o.id) != null)?.id
                  const ps = items.filter(it => it.kind === 'p').map(it => idx.byId[it.id]).filter(p => p && p.pricing_mode !== 'consult' && p.stock !== 'out' && (p.pricing_mode === 'fixed' || optFor(p)))
                  return ps.length > 1 && (
                    <button className="key key--accent key--sm lu-act" onClick={e => { const el = e.currentTarget; ps.forEach((p, k) => setTimeout(() => onAdd(p, el, optFor(p)), k * 180)) }}>
                      <Plus size={15} /> Agregar las {ps.length} al carrito
                    </button>
                  )
                })()}
                {m.web && (
                  <div className="lu-web">
                    <b>Dato tomado de internet</b>
                    <span>Los catálogos de cada plataforma cambian según el país y la fecha. Confírmalo con nosotros antes de comprar.</span>
                    {m.sources?.length > 0 && <span className="lu-web__src">{m.sources.map((x, k) => <a key={k} href={x.uri} target="_blank" rel="noopener noreferrer nofollow">{x.title}</a>)}</span>}
                  </div>
                )}
              </div>
            )
          })}
          {busy && <div className="lu-msg is-bot is-typing" aria-label={`${name} está escribiendo`}><span /><span /><span /></div>}
        </div>
        {blocked ? (
          <div className="lu-limit">
            <b>Llegaste al límite de mensajes de hoy</b>
            <span>Puedes volver a escribirle a {name} mañana. Si te urge, te atendemos por WhatsApp.</span>
            {waHref && <a className="key key--wa key--sm" href={waFor()} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Escribir por WhatsApp</a>}
          </div>
        ) : quota?.left != null && quota.left <= 3 && (
          <div className="lu-left">Te {quota.left === 1 ? 'queda 1 mensaje' : `quedan ${quota.left} mensajes`} con {name} hoy.</div>
        )}
        <form className="lu__input" onSubmit={e => { e.preventDefault(); send() }}>
          <textarea ref={input} rows={1} value={text} maxLength={500} disabled={blocked} placeholder={blocked ? 'Vuelve mañana para seguir conversando' : `Escríbele a ${name}…`} aria-label="Tu mensaje"
            onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} enterKeyHint="send" />
          <button className="key key--accent key--icon" disabled={!text.trim() || busy || blocked} aria-label="Enviar"><Send size={17} /></button>
        </form>
      </section>
      {zoom && (
        <div className="lu-zoom" role="dialog" aria-modal="true" aria-label="Imagen ampliada" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" />
          <button className="key key--icon" aria-label="Cerrar imagen"><X size={18} /></button>
        </div>
      )}
    </>, document.body)
}
