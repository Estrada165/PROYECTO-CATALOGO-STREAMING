import { Link } from 'react-router-dom'
import { Copy, ExternalLink, CheckCircle2, Circle, LayoutGrid, Boxes, Megaphone, Wallet, MessageCircle, ArrowRight, Plus, Palette, Table2, Share2 } from 'lucide-react'
import { usePanel } from '../PanelApp'
import { copyText } from '../../lib/clipboard'

const fmtDate = d => new Date(d).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })
const PLAN = { mensual: 'Mensual', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual', personalizado: 'Personalizado', demo: 'Demostración' }

// Ilustración: una vitrina con tarjetas (usa el color del catálogo)
function Storefront() {
  return (
    <svg className="pillu" viewBox="0 0 220 150" aria-hidden="true">
      <defs><linearGradient id="pg1" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".95" /><stop offset="1" stopColor="var(--accent-edge)" /></linearGradient></defs>
      <rect x="18" y="26" width="184" height="112" rx="16" fill="var(--surface)" stroke="var(--line-strong)" />
      <path d="M18 46a16 16 0 0 1 16-20h152a16 16 0 0 1 16 20z" fill="url(#pg1)" />
      {[0, 1, 2, 3, 4, 5].map(i => <path key={i} d={`M${18 + i * 30.7} 46q15.3 14 30.7 0`} fill="var(--accent-edge)" opacity=".55" />)}
      {[0, 1, 2].map(i => (
        <g key={i} transform={`translate(${34 + i * 54} 66)`}><g className={`pillu__card pillu__card--${i}`}>
          <rect width="44" height="58" rx="10" fill="var(--bg)" stroke="var(--line)" />
          <rect x="12" y="8" width="20" height="20" rx="6" fill={['#E50914', '#1DB954', '#0063E5'][i]} />
          <rect x="9" y="34" width="26" height="4" rx="2" fill="var(--line-strong)" />
          <rect x="7" y="44" width="30" height="8" rx="4" fill="var(--accent)" />
        </g></g>
      ))}
      <circle cx="196" cy="24" r="14" fill="var(--wa)" /><path d="M190 24l4 4 8-8" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Ring({ pct, tone }) {
  const r = 46, c = 2 * Math.PI * r
  return (
    <svg className={`pring pring--${tone}`} viewBox="0 0 110 110" aria-hidden="true">
      <circle cx="55" cy="55" r={r} className="pring__bg" />
      <circle cx="55" cy="55" r={r} className="pring__fg" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
    </svg>
  )
}

export default function Inicio() {
  const { data, tenant, toast, expired } = usePanel()
  const s = data.settings
  const url = `${location.origin}/c/${tenant.slug}`
  const total = Math.max(1, (new Date(tenant.expires_at) - new Date(tenant.starts_at)) / 864e5)
  const left = Math.max(0, Math.ceil((new Date(tenant.expires_at) - new Date()) / 864e5))
  const pct = Math.min(100, Math.max(2, (left / total) * 100))
  const tone = expired ? 'danger' : left <= 7 ? 'warn' : 'ok'
  const now = Date.now()
  const activeAnns = data.anns.filter(a => a.is_active && new Date(a.starts_at) <= now && (!a.ends_at || new Date(a.ends_at) > now)).length
  const priced = data.platforms.filter(p => p.active && (p.pricing_mode !== 'options' || p.prices.length)).length
  const checks = [
    { ok: !!s.logo_url, label: 'Sube tu logo', to: 'marca' },
    { ok: !!s.whatsapp, label: 'Agrega tu WhatsApp', to: 'marca' },
    { ok: priced > 0, label: 'Pon precio a tus plataformas', to: 'plataformas' },
    { ok: data.payments.some(m => m.active), label: 'Agrega un método de pago', to: 'pagos' },
    { ok: data.faqs.some(f => f.active), label: 'Responde las preguntas frecuentes', to: 'textos' },
  ]
  const done = checks.filter(c => c.ok).length
  const h = new Date().getHours()
  const hello = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: s.business_name, url }) } catch { /* cancelado */ } }
    else if (await copyText(url)) toast('Enlace copiado')
  }

  return (
    <div className="phome">
      <section className="phome__hero">
        <div className="phome__txt">
          <small className="peyebrow">{hello} 👋</small>
          <h1>{s.business_name}</h1>
          <p>Todo lo que cambies aquí se ve al instante en tu catálogo.</p>
          <div className="plink">
            <span className="tnum">{url.replace(/^https?:\/\//, '')}</span>
            <button className="key key--sm" onClick={async () => { if (await copyText(url)) toast('Enlace copiado') }}><Copy size={15} /> Copiar</button>
            <button className="key key--sm" onClick={share}><Share2 size={15} /> Compartir</button>
            <a className="key key--sm key--accent" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> Abrir</a>
          </div>
        </div>
        <Storefront />
      </section>

      <div className="phome__grid">
        <section className={`pcard pplanc pplanc--${tone}`}>
          <div className="pplanc__ring">
            <Ring pct={expired ? 100 : pct} tone={tone} />
            <div><b className="tnum">{left}</b><small>{left === 1 ? 'día' : 'días'}</small></div>
          </div>
          <div className="pplanc__txt">
            <small className="peyebrow">Plan {PLAN[tenant.plan] || tenant.plan}</small>
            <b>{expired ? 'Tu plan venció' : left <= 7 ? 'Renueva pronto' : 'Todo en orden'}</b>
            <p className="pmuted">{expired ? `Venció el ${fmtDate(tenant.expires_at)}.` : `Vence el ${fmtDate(tenant.expires_at)}.`}</p>
            {(expired || left <= 10) && (
              <a className="key key--wa key--sm" href={`https://api.whatsapp.com/send?phone=${import.meta.env.VITE_SUPPORT_WHATSAPP || '51904670421'}&text=${encodeURIComponent(`Hola 👋 Quiero renovar mi catálogo ${s.business_name} (/c/${tenant.slug}).`)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={15} /> Renovar
              </a>
            )}
          </div>
        </section>

        <section className="pcard">
          <small className="peyebrow">Tu catálogo hoy</small>
          <div className="pstats pstats--home">
            <Link to="plataformas"><LayoutGrid size={17} /><b className="tnum">{data.platforms.filter(p => p.active).length}</b><small>plataformas</small></Link>
            <Link to="combos"><Boxes size={17} /><b className="tnum">{data.combos.filter(c => c.active).length}</b><small>combos</small></Link>
            <Link to="avisos"><Megaphone size={17} /><b className="tnum">{activeAnns}</b><small>avisos activos</small></Link>
            <Link to="pagos"><Wallet size={17} /><b className="tnum">{data.payments.filter(m => m.active).length}</b><small>métodos de pago</small></Link>
          </div>
        </section>
      </div>

      <section className="pquickacts">
        <Link to="plataformas" className="pqa"><span className="pqa__ic" style={{ '--c': '#2563EB' }}><Plus size={19} /></span><b>Agregar plataforma</b><small>Desde la biblioteca o desde cero</small></Link>
        <Link to="plataformas" className="pqa"><span className="pqa__ic" style={{ '--c': '#16A34A' }}><Table2 size={19} /></span><b>Cambiar precios</b><small>Tabla de precios rápida</small></Link>
        <Link to="avisos" className="pqa"><span className="pqa__ic" style={{ '--c': '#D946EF' }}><Megaphone size={19} /></span><b>Publicar un aviso</b><small>Promos y novedades</small></Link>
        <Link to="marca" className="pqa"><span className="pqa__ic" style={{ '--c': 'var(--accent)' }}><Palette size={19} /></span><b>Personalizar marca</b><small>Logo, color y tipografías</small></Link>
      </section>

      {done < checks.length && (
        <section className="pcard">
          <div className="pcard__head"><h2>Deja tu catálogo listo</h2><span className="ppill tnum">{done} de {checks.length}</span></div>
          <div className="pbar"><span style={{ width: `${(done / checks.length) * 100}%` }} /></div>
          <ul className="pchecks">
            {checks.map(c => (
              <li key={c.label} className={c.ok ? 'is-ok' : ''}>
                {c.ok ? <CheckCircle2 size={19} /> : <Circle size={19} />}
                <span>{c.label}</span>
                {!c.ok && <Link to={c.to} className="link-btn">Hacerlo <ArrowRight size={14} /></Link>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
