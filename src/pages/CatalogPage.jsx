import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Search, X, Bell, Moon, Sun, ShoppingBag, Zap, ShieldCheck, MessageCircle, Plus, ChevronRight, Check, FileText,
  Megaphone, MousePointerClick, Wallet, Send, Clock, MapPin, ArrowUpRight, Tag, Layers,
} from 'lucide-react'
import { fetchCatalog, indexCatalog, priceFor, visibleUnder } from '../lib/catalog'
import { cartReducer, lineKey, summarize, waLink, consultMessage } from '../lib/cart'
import { money, store, session } from '../lib/format'
import { applyPalette } from '../lib/color'
import { applyFonts } from '../lib/fonts'
import InfoTip from '../components/InfoTip'
import { helpTexts } from '../lib/help'
import { switchTheme, flyPlane, bump, haptic } from '../lib/motion'
import PlatformCard from '../components/PlatformCard'
import PlatformSheet from '../components/PlatformSheet'
import CartSheet from '../components/CartSheet'
import Announcements from '../components/Announcements'
import Sheet from '../components/Sheet'
import LuChat from '../components/LuChat'
import PlatformBar from '../components/PlatformBar'
import { StateScreen, LoadingScreen } from './StateScreens'

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function CatalogPage() {
  const { slug: rawSlug } = useParams()
  const slug = String(rawSlug || '').toLowerCase()
  const [cat, setCat] = useState(undefined)
  // Vista previa del panel: recibe los cambios sin guardar por postMessage
  const preview = useMemo(() => new URLSearchParams(location.search).has('preview') && window.parent !== window, [])
  const [draft, setDraft] = useState(null)
  useEffect(() => {
    if (!preview) return
    const on = e => { if (e.origin === location.origin && e.data?.type === 'cs:preview') setDraft(e.data) }
    addEventListener('message', on)
    window.parent.postMessage({ type: 'cs:preview-ready' }, location.origin)
    return () => removeEventListener('message', on)
  }, [preview])

  useEffect(() => {
    let alive = true
    setCat(undefined)
    fetchCatalog(slug).then(d => alive && setCat(d)).catch(() => alive && setCat({ state: 'error' }))
    return () => { alive = false }
  }, [slug])

  if (cat === undefined) return <LoadingScreen />
  if (cat === null) return <StateScreen title="No encontramos este catálogo" text="Revisa el enlace o pídele uno nuevo a quien te lo compartió." />
  if (cat.state === 'error') return <StateScreen title="No pudimos cargar el catálogo" text="Revisa tu conexión e inténtalo de nuevo." retry />
  if (cat.state === 'unavailable') return <Unavailable cat={cat} />
  const shown = draft && cat.state === 'ok'
    ? { ...cat, settings: { ...cat.settings, ...(draft.settings || {}) }, ...(draft.patch || {}) }
    : cat
  return <Catalog cat={shown} slug={slug} preview={preview} previewTheme={draft?.theme} />
}

function Unavailable({ cat }) {
  useEffect(() => { applyPalette(document.documentElement, cat.accent || '#FF6B35'); document.title = cat.name }, [cat])
  return (
    <StateScreen logo={cat.logo_url} title={`${cat.name} vuelve pronto`}
      text="El catálogo está en mantenimiento. Puedes escribirnos mientras tanto."
      action={cat.whatsapp && <a className="key key--wa key--lg" href={waLink(cat.whatsapp, 'Hola 👋 Vi que el catálogo está en mantenimiento. ¿Me ayudan con un pedido?')} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> Escribir por WhatsApp</a>} />
  )
}

function Catalog({ cat, slug, preview = false, previewTheme }) {
  const s = cat.settings
  const sym = s.currency_symbol || 'S/'
  const idx = useMemo(() => indexCatalog(cat), [cat])
  const [optionId, setOptionId] = useState(idx.defaultOption?.id)
  const [catId, setCatId] = useState('all')
  const [pf, setPf] = useState(null) // plataforma elegida en la barra animada
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [annOpen, setAnnOpen] = useState(false)
  const [annStart, setAnnStart] = useState(0)
  const [termsOpen, setTermsOpen] = useState(false)
  const [howOpen, setHowOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [theme, setTheme] = useState(() => {
    const saved = store.get(`cs-theme:${slug}`)
    if (saved === 'light' || saved === 'dark') return saved
    if (s.theme_default === 'system') return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    return s.theme_default || 'light'
  })
  const [lines, dispatch] = useReducer(cartReducer, [], () => store.get(`cs-cart:${slug}`, []))
  const [seen, setSeen] = useState(() => store.get(`cs-seen:${slug}`, []))
  const cartBtn = useRef(null), cartBarBtn = useRef(null), themeBtn = useRef(null)

  // Marca, color, tipografía, tema
  useEffect(() => {
    const root = document.documentElement
    applyPalette(root, s.accent)
    root.style.setProperty('--r', `${s.radius || 18}px`)
    root.dataset.cards = s.card_style || 'tecla'
    applyFonts({ display: s.font_display, body: s.font_body, cards: s.font_cards })
    document.title = s.tagline ? `${s.business_name} · ${s.tagline}` : s.business_name
    if (s.logo_url) {
      let ic = document.querySelector('link[rel="icon"]')
      if (ic) { ic.href = s.favicon_url || s.logo_url; ic.type = 'image/webp' }
    }
  }, [s])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d0e11' : '#f4f5f7')
  }, [theme])
  useEffect(() => { if (previewTheme === 'light' || previewTheme === 'dark') setTheme(previewTheme) }, [previewTheme])
  useEffect(() => { if (!preview) store.set(`cs-cart:${slug}`, lines) }, [lines, slug, preview])
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 120)
    on(); window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  const toast = useCallback(msg => {
    setToastMsg(msg)
    clearTimeout(toast.t); toast.t = setTimeout(() => setToastMsg(null), 1900)
  }, [])

  // Avisos: el popup sale una vez por visita si hay algo nuevo
  const anns = cat.announcements || []
  const unseen = anns.filter(a => !seen.includes(a.id))
  useEffect(() => {
    if (preview || !unseen.some(a => a.show_popup) || session.get(`cs-ann:${slug}`)) return
    const t = setTimeout(() => { setAnnOpen(true); session.set(`cs-ann:${slug}`, '1') }, 900)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const closeAnns = () => {
    setAnnOpen(false)
    const ids = [...new Set([...seen, ...anns.map(a => a.id)])]
    setSeen(ids); store.set(`cs-seen:${slug}`, ids)
  }
  const annAction = a => {
    closeAnns()
    if (a.cta_kind === 'platform') setTimeout(() => setDetail(idx.byId[a.cta_value] || null), 260)
    else if (a.cta_kind === 'whatsapp') window.open(waLink(s.whatsapp, a.cta_value || a.title), '_blank', 'noopener')
    else if (a.cta_kind === 'url' && a.cta_value) {
      if (a.cta_value.startsWith('#')) setTimeout(() => document.querySelector(a.cta_value)?.scrollIntoView({ behavior: 'smooth' }), 260)
      else window.open(a.cta_value, '_blank', 'noopener')
    }
  }

  // Filtros
  const words = norm(q).split(/\s+/).filter(Boolean)
  const matches = p => {
    if (!words.length) return true
    const hay = norm([p.name, ...(p.tags || []), ...(p.popular_content || []), idx.catById[p.category_id]?.name].join(' '))
    return words.every(w => hay.includes(w))
  }
  const visible = idx.platforms.filter(p => visibleUnder(p, optionId) && (catId === 'all' || p.category_id === catId) && matches(p))
  const elsewhere = words.length && !visible.length
    ? idx.options.filter(o => o.id !== optionId && idx.platforms.some(p => visibleUnder(p, o.id) && matches(p)))
    : []
  const countFor = cid => idx.platforms.filter(p => visibleUnder(p, optionId) && (cid === 'all' || p.category_id === cid)).length
  const cats = (cat.categories || []).filter(c => countFor(c.id) > 0)

  const summary = useMemo(() => summarize(lines, idx, cat), [lines, idx, cat])
  const qtyOf = (p) => lines.filter(l => l.platformId === p.id && (p.pricing_mode === 'fixed' || l.optionId === optionId)).reduce((n, l) => n + l.qty, 0)

  const cartTarget = () => (cartBarBtn.current?.offsetParent ? cartBarBtn.current : cartBtn.current)
  const land = () => { bump(cartTarget()); haptic() }
  const addPlatform = (p, fromEl, opt = optionId) => {
    const o = p.pricing_mode === 'fixed' ? null : opt
    if (p.pricing_mode === 'options' && priceFor(p, o) == null) return
    dispatch({ type: 'add', line: { key: lineKey(p.id, o), kind: 'platform', platformId: p.id, optionId: o } })
    flyPlane(fromEl, cartTarget(), land)
  }
  const decPlatform = p => dispatch({ type: 'dec', key: lineKey(p.id, p.pricing_mode === 'fixed' ? null : optionId) })
  const consult = p => window.open(waLink(s.whatsapp, consultMessage(p.name)), '_blank', 'noopener')

  const rules = cat.discount_rules || []
  const combos = (cat.combos || []).map(c => {
    const ps = c.platform_ids.map(id => idx.byId[id]).filter(Boolean)
    const prices = ps.map(p => priceFor(p, c.option_id))
    if (ps.length < 2 || prices.some(x => x == null)) return null
    const sum = prices.reduce((a, b) => a + b, 0)
    const elig = ps.filter(p => idx.catById[p.category_id]?.combo_eligible).length
    const rule = [...rules].sort((a, b) => b.min_items - a.min_items).find(r => elig >= r.min_items)
    const final = c.custom_price != null ? Number(c.custom_price) : sum - (rule ? Number(rule.discount) : 0)
    return { ...c, ps, sum, final }
  }).filter(Boolean)
  const addCombo = (c, el) => {
    if (c.custom_price != null) dispatch({ type: 'add', line: { key: `combo:${c.id}`, kind: 'combo', comboId: c.id } })
    else c.ps.forEach(p => dispatch({ type: 'add', line: { key: lineKey(p.id, c.option_id), kind: 'platform', platformId: p.id, optionId: c.option_id } }))
    flyPlane(el, cartTarget(), land)
    toast(`${c.name} en tu carrito`)
  }

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    switchTheme(next, themeBtn.current, t => { document.documentElement.dataset.theme = t; setTheme(t) })
    store.set(`cs-theme:${slug}`, next)
  }

  const hasWarranty = s.warranty_days > 0
  const option = idx.optionById[optionId]
  const openAnns = (i = 0) => { setAnnStart(i); setAnnOpen(true) }
  // Desplazamiento a una sección, descontando la barra fija y el filtro
  const goTo = sel => {
    const el = document.querySelector(sel); if (!el) return
    const off = (document.querySelector('.top')?.offsetHeight || 60) + (sel === '#catalogo-grid' ? 0 : (document.querySelector('.ctrl')?.offsetHeight || 0)) + 8
    const y = sel === '#catalogo-grid'
      ? document.querySelector('.ctrl').getBoundingClientRect().top + scrollY - (document.querySelector('.top')?.offsetHeight || 60)
      : el.getBoundingClientRect().top + scrollY - off
    scrollTo({ top: Math.max(0, y), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  // Ayuda: abre a Lu cuando esté disponible; mientras tanto, WhatsApp
  const botReady = Boolean(cat.bot?.enabled && cat.bot?.live)
  const helpLabel = botReady ? `Preguntarle a ${cat.bot.name}` : 'Pedir ayuda por WhatsApp'
  const askHelp = () => {
    if (botReady) window.dispatchEvent(new CustomEvent('cs:open-bot'))
    else if (s.whatsapp) window.open(waLink(s.whatsapp, 'Hola 👋 Quiero ayuda para hacer mi pedido.'), '_blank', 'noopener')
  }
  const tip = helpTexts(s, rules, sym)
  const popular = idx.platforms.filter(p => p.badge === 'popular' && p.logo_url && (p.pricing_mode !== 'options' || priceFor(p, optionId) != null)).slice(0, 6)
  const marquee = idx.platforms.filter(p => p.logo_url)
  const pfP = pf ? idx.byId[pf] : null
  const pfCards = pfP ? (pfP.pricing_mode === 'options' ? idx.options.filter(o => priceFor(pfP, o.id) != null) : [null]) : []
  const qtyIn = (p, oid) => lines.filter(l => l.platformId === p.id && (p.pricing_mode !== 'options' || l.optionId === oid)).reduce((n, l) => n + l.qty, 0)
  const shownCombos = pf ? combos.filter(c => c.platform_ids.includes(pf)) : combos
  const STEP_ICONS = [MousePointerClick, ShoppingBag, Wallet, Send]
  const year = new Date().getFullYear()

  return (
    <>
      {anns.length > 0 && (
        <button className="annbar" onClick={() => openAnns(0)}>
          <span className="wrap annbar__in">
            <span className={`annbar__dot${unseen.length ? ' is-new' : ''}`} aria-hidden="true"><Megaphone size={14} /></span>
            <span className="annbar__txt"><b>{unseen.length ? 'Nuevo' : 'Aviso'}</b>{anns[0].title}</span>
            {anns.length > 1 && <span className="annbar__more tnum">+{anns.length - 1}</span>}
            <span className="annbar__go">Ver <ChevronRight size={15} /></span>
          </span>
        </button>
      )}
      <header className={`top${scrolled ? ' is-scrolled' : ''}`}>
        <div className="wrap top__in">
          <a className="top__brand" href="#top" aria-label={`${s.business_name}, ir al inicio`}>
            {s.logo_url && <img className={`top__logo${s.logo_shape === 'round' ? ' is-round' : ''}`} src={s.logo_url} alt="" width="36" height="36" />}
            <span className="top__name">{s.business_name}</span>
          </a>
          <div className="top__actions">
            {anns.length > 0 && (
              <button className={`key key--icon has-badge${unseen.length ? ' bell-unseen' : ''}`} onClick={() => openAnns(0)} aria-label={`Avisos${unseen.length ? `, ${unseen.length} nuevos` : ''}`}>
                <Bell size={19} />{unseen.length > 0 && <span className="badge-dot">{unseen.length}</span>}
              </button>
            )}
            <button ref={themeBtn} className="key key--icon" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}>
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button ref={cartBtn} className="key key--icon has-badge" onClick={() => setCartOpen(true)} aria-label={`Carrito, ${summary.count} productos`}>
              <ShoppingBag size={19} />{summary.count > 0 && <span className="badge-dot tnum">{summary.count}</span>}
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero wrap">
          <div className="hero__main">
          <p className="hero__place">
            <span className="hero__live" aria-hidden="true" />
            {s.support_hours ? `Atendemos ${s.support_hours.charAt(0).toLowerCase()}${s.support_hours.slice(1)}` : 'Catálogo en línea'}
          </p>
          <h1 className="hero__title"><span>{s.business_name}</span></h1>
          {s.tagline && <p className="hero__tag">{s.tagline}</p>}
          <div className="hero__row">
            <div className="search" role="search">
              <Search size={19} />
              <label className="sr-only" htmlFor="q">Buscar plataforma o contenido</label>
              <input id="q" type="search" value={q} onChange={e => { setQ(e.target.value); setPf(null) }} placeholder="Busca Netflix, anime, fútbol…" autoComplete="off" enterKeyHint="search" />
              {q && <button className="search__clear" onClick={() => setQ('')} aria-label="Borrar búsqueda"><X size={18} /></button>}
            </div>
          </div>
          <ul className="meta">
            {s.delivery_time && (
              <li><Zap size={15} /><span>Entrega en <b>{s.delivery_time}</b></span><InfoTip label="¿Cómo recibo mi acceso?">{tip.delivery}</InfoTip></li>
            )}
            {hasWarranty && (
              <li><ShieldCheck size={15} /><span>Garantía de <b>{s.warranty_days} días</b></span>
                <InfoTip label="Garantía" action={s.terms?.length > 0 && <button className="link-btn" onClick={() => setTermsOpen(true)}>Ver condiciones</button>}>{tip.warranty}</InfoTip></li>
            )}
            {s.show_how_to_buy && s.how_to_buy?.length > 0 && (
              <li><button className="meta__link" onClick={() => setHowOpen(true)}><MousePointerClick size={15} /> ¿Cómo comprar?</button></li>
            )}
            {s.whatsapp && (
              <li><a className="meta__link is-wa" href={waLink(s.whatsapp, 'Hola 👋 Tengo una consulta sobre el catálogo.')} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Escríbenos</a></li>
            )}
          </ul>
          {popular.length > 2 && (
            <div className="picks">
              <span className="picks__lbl">Lo más pedido</span>
              <div className="picks__row">
                {popular.map(p => (
                  <button key={p.id} className="pick" onClick={() => setDetail(p)} aria-label={`Ver ${p.name}`}>
                    <img src={p.logo_url} alt="" width="28" height="28" />
                    <span>{p.name.split(/ [—+(-]/)[0]}</span>
                    {priceFor(p, optionId) != null && <b className="tnum">{money(priceFor(p, optionId), sym)}</b>}
                  </button>
                ))}
              </div>
            </div>
          )}
          </div>
          <div className="hero__art" aria-hidden="true">
            {idx.platforms.filter(p => p.logo_url).slice(0, 9).map((p, i) => (
              <img key={p.id} src={p.logo_url} alt="" width="84" height="84" style={{ '--i': i }} />
            ))}
          </div>
        </section>

        <div className="ctrl" id="catalogo">
          <div className="wrap ctrl__in">
            {idx.options.length > 1 && (
              <div className="seg-row">
                <div className="seg" role="group" aria-label="Tipo de acceso y duración">
                  {idx.options.map(o => (
                    <button key={o.id} className="seg__btn" aria-pressed={o.id === optionId} onClick={() => { setOptionId(o.id); haptic(8) }}>
                      <b>{o.label}</b><small>{o.period}</small>
                    </button>
                  ))}
                </div>
                <InfoTip label="¿Perfil o cuenta completa?">{tip.plan}</InfoTip>
              </div>
            )}
            {marquee.length > 2 && (
              <PlatformBar items={marquee} selected={pf} onPick={id => { setPf(id === pf ? null : id); setQ(''); haptic(8); setTimeout(() => goTo('#catalogo-grid'), 60) }} onClear={() => setPf(null)} />
            )}
          </div>
        </div>

        <section className="section wrap" id="catalogo-grid" aria-labelledby="grid-title">
          <div className="section__head">
            <h2 className="section__title" id="grid-title">{pfP ? pfP.name : option ? `${option.label} · ${option.period}` : 'Catálogo'}</h2>
            {pfP
              ? <button className="count-pill count-pill--clear" onClick={() => setPf(null)}><X size={15} /> Ver todas</button>
              : <span className="count-pill tnum"><Layers size={15} /><b>{visible.length}</b> {visible.length === 1 ? 'plataforma' : 'plataformas'}</span>}
          </div>
          {rules.length > 0 && (
            <div className="promo-line">
              <Tag size={16} />
              <span>{[...rules].sort((a, b) => a.min_items - b.min_items).map(r => `${r.min_items} plataformas: −${money(r.discount, sym)}`).join(' · ')}</span>
              <InfoTip label="Descuento por cantidad">{tip.discounts}</InfoTip>
            </div>
          )}
          {pfP ? (
            <div className="grid">
              {pfCards.map((o, i) => (
                <PlatformCard key={o?.id || 'unico'} p={pfP} index={i} optionId={o?.id ?? optionId} option={o} qty={qtyIn(pfP, o?.id)} sym={sym}
                  onOpen={setDetail} onAdd={(p, el) => addPlatform(p, el, o?.id ?? optionId)} onConsult={consult}
                  onDec={() => dispatch({ type: 'dec', key: lineKey(pfP.id, pfP.pricing_mode === 'fixed' ? null : o?.id) })} />
              ))}
            </div>
          ) : visible.length ? (
            <div className="grid">
              {visible.map((p, i) => (
                <PlatformCard key={p.id} p={p} index={i} optionId={optionId} option={option} qty={qtyOf(p)} sym={sym}
                  onOpen={setDetail} onAdd={addPlatform} onDec={() => decPlatform(p)} onConsult={consult} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <b>{words.length ? `Nada con “${q.trim()}” en esta opción` : 'No hay plataformas en esta opción'}</b>
              {elsewhere.length > 0 ? (
                <>Lo encontramos en {elsewhere.map((o, k) => (
                  <span key={o.id}>{k > 0 && ', '}<button className="link-btn" onClick={() => setOptionId(o.id)}>{o.label} · {o.period}</button></span>
                ))}.</>
              ) : s.whatsapp && words.length ? (
                <>¿No lo ves? <a className="link-btn" href={waLink(s.whatsapp, consultMessage(q.trim()))} target="_blank" rel="noopener noreferrer">Pregúntanos por WhatsApp</a>.</>
              ) : 'Prueba con otra categoría.'}
            </div>
          )}
        </section>

        {shownCombos.length > 0 && (
          <section className="section wrap" id="combos" aria-labelledby="combos-title">
            <div className="section__head">
              <h2 className="section__title" id="combos-title">Combos <InfoTip label="¿Qué es un combo?">{tip.combos}</InfoTip></h2>
              <span className="count-pill tnum"><Layers size={15} /><b>{shownCombos.length}</b> {shownCombos.length === 1 ? 'combo' : 'combos'}</span>
            </div>
            <div className="combos">
              {shownCombos.map(c => (
                <article className="combo" key={c.id}>
                  <div className="combo__top">
                    <div className="combo__logos">{c.ps.map(p => <img key={p.id} src={p.logo_url} alt={p.name} title={p.name} width="44" height="44" />)}</div>
                    {c.final < c.sum && <span className="combo__save tnum">−{money(c.sum - c.final, sym)}</span>}
                  </div>
                  <div>
                    {c.badge && <div className="combo__badge">{c.badge}</div>}
                    <h3 className="combo__name">{c.name}</h3>
                  </div>
                  <p className="combo__desc">{c.description || c.ps.map(p => p.name).join(' + ')}</p>
                  <div className="combo__price tnum">
                    <b>{money(c.final, sym)}</b>
                    {c.final < c.sum && <s>{money(c.sum, sym)}</s>}
                    {idx.optionById[c.option_id] && <small>{idx.optionById[c.option_id].label} · {idx.optionById[c.option_id].period}</small>}
                  </div>
                  <button className="key key--accent key--block" onClick={e => addCombo(c, e.currentTarget)}><Plus size={17} strokeWidth={2.6} /> Agregar combo</button>
                </article>
              ))}
            </div>
          </section>
        )}

        {(cat.faqs?.length > 0 || s.terms?.length > 0) && (
          <section className="section wrap" id="preguntas" aria-labelledby="faq-title">
            <div className="section__head"><h2 className="section__title" id="faq-title">Preguntas frecuentes</h2></div>
            <div className="faq">
              {cat.faqs.map((f, i) => (
                <details key={i}><summary>{f.q}<Plus size={18} /></summary><p>{f.a}</p></details>
              ))}
              {s.terms?.length > 0 && (
                <button className="key" style={{ alignSelf: 'flex-start', marginTop: 8 }} onClick={() => setTermsOpen(true)}>
                  <FileText size={17} /> Garantía y condiciones <ChevronRight size={16} />
                </button>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="foot">
        <div className="wrap">
          <div className="foot__cta">
            <div>
              <h2>¿Tienes dudas antes de comprar?</h2>
              <p>{s.support_hours ? `Te respondemos ${s.support_hours.charAt(0).toLowerCase()}${s.support_hours.slice(1)}.` : 'Escríbenos y te ayudamos con tu pedido.'}</p>
            </div>
            <div className="foot__cta-btns">
              {botReady && <button className="key key--lg" onClick={askHelp}>Preguntarle a {cat.bot.name}</button>}
              {s.whatsapp && <a className="key key--wa key--lg" href={waLink(s.whatsapp, 'Hola 👋 Tengo una consulta sobre el catálogo.')} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> Escribir por WhatsApp</a>}
            </div>
          </div>
          <div className="foot__grid">
            <div className="foot__brand">
              <div className="foot__id">{s.logo_url && <img src={s.logo_url} alt="" width="40" height="40" className={s.logo_shape === 'round' ? 'is-round' : ''} />}<b>{s.business_name}</b></div>
              {(s.description || s.tagline) && <p>{s.description || s.tagline}</p>}
            </div>
            <nav className="foot__col" aria-label="Secciones">
              <h3>Explorar</h3>
              <button onClick={() => goTo('#catalogo-grid')}>Catálogo</button>
              {combos.length > 0 && <button onClick={() => goTo('#combos')}>Combos</button>}
              {cat.faqs?.length > 0 && <button onClick={() => goTo('#preguntas')}>Preguntas frecuentes</button>}
              {s.terms?.length > 0 && <button onClick={() => setTermsOpen(true)}>Garantía y condiciones</button>}
            </nav>
            <div className="foot__col">
              <h3>Atención</h3>
              {s.support_hours && <span><Clock size={15} />{s.support_hours}</span>}
              {s.whatsapp_display && <span><MessageCircle size={15} />{s.whatsapp_display}</span>}
              {s.location && <span><MapPin size={15} />{s.location}</span>}
              {cat.payment_methods?.length > 0 && (
                <div className="foot__pays">{cat.payment_methods.map(m => m.logo_url && <img key={m.id} src={m.logo_url} alt={m.name} title={m.name} width="28" height="28" />)}</div>
              )}
            </div>
          </div>
          <div className="foot__bottom">
            <span>© {year} {s.business_name}</span>
            {cat.credit && <span className="foot__made">Catálogo hecho con <b>C-Stream</b></span>}
          </div>
        </div>
        <div className="bar-space" />
      </footer>

      {summary.count > 0 && !cartOpen && (
        <button className="cart-bar" ref={cartBarBtn} onClick={() => setCartOpen(true)} aria-label="Ver carrito">
          <span className="cart-bar__count tnum">{summary.count}</span>
          <span className="cart-bar__txt">
            <small>{summary.discount > 0 ? `Ahorras ${money(summary.discount, sym)}` : 'Tu pedido'}</small>
            <b className="tnum">{money(summary.total, sym)}</b>
          </span>
          <span className="key key--accent key--sm">Ver carrito <ChevronRight size={16} /></span>
        </button>
      )}

      <PlatformSheet p={detail} idx={idx} optionId={optionId} sym={sym} onClose={() => setDetail(null)}
        onConsult={consult}
        onAdd={(p, el, opt) => { addPlatform(p, el, opt); toast(`${p.name} en tu carrito`); setTimeout(() => setDetail(null), 120) }} />
      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} summary={summary} cat={cat} sym={sym} dispatch={dispatch} slug={slug} toast={toast} />
      <Announcements items={anns} start={annStart} open={annOpen} onClose={closeAnns} onAction={annAction} />
      <Sheet open={howOpen} onClose={() => setHowOpen(false)} title="Cómo comprar"
        footer={<div className="row-2 row-2--eq">
          <button className="key key--lg" onClick={() => { setHowOpen(false); askHelp() }}>{botReady ? `Preguntar a ${cat.bot.name}` : 'Pedir ayuda'}</button>
          <button className="key key--accent key--lg" onClick={() => { setHowOpen(false); setTimeout(() => goTo('#catalogo-grid'), 250) }}>Empezar a elegir</button>
        </div>}>
        <ol className="howsteps">
          {(s.how_to_buy || []).map((st, i) => {
            const Ic = STEP_ICONS[i] || Check
            return <li key={i}><span className="howsteps__ic"><Ic size={18} /><em className="tnum">{i + 1}</em></span><div><b>{st.title}</b><p>{st.text}</p></div></li>
          })}
        </ol>
        {cat.payment_methods?.length > 0 && (
          <div className="howpays"><small>{tip.payment}</small>
            <div>{cat.payment_methods.map(m => <span key={m.id} className="howpays__m">{m.logo_url && <img src={m.logo_url} alt="" width="22" height="22" />}{m.name}</span>)}</div>
          </div>
        )}
      </Sheet>
      <Sheet open={termsOpen} onClose={() => setTermsOpen(false)} title="Garantía y condiciones">
        {(s.terms || []).map((t, i) => (
          <div className="block" key={i}><h4>{t.title}</h4>
            <ul className="ticks">{t.items.map((x, j) => <li key={j}><Check size={16} strokeWidth={2.6} />{x}</li>)}</ul>
          </div>
        ))}
      </Sheet>
      <LuChat cat={cat} slug={slug} idx={idx} optionId={optionId} sym={sym} hidden={cartOpen || preview} forceClose={cartOpen}
        onAdd={(p, el) => { addPlatform(p, el); toast(`${p.name} en tu carrito`) }} onAddCombo={addCombo} onOpenCart={() => setCartOpen(true)}
        waHref={s.whatsapp ? waLink(s.whatsapp, 'Hola 👋 Vengo del catálogo y tengo una consulta.') : null} waNumber={s.whatsapp} />
      {toastMsg && <div className="toast" role="status"><Check size={16} />{toastMsg}</div>}
    </>
  )
}

