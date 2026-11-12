import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Store, Settings2, LogOut, Plus, Search, Loader2, Check, MessageCircle, ExternalLink, Pencil,
  CalendarPlus, History, Trash2, ShieldAlert, Menu, PanelLeftClose, PanelLeftOpen, KeyRound, Copy, Link2, Unlink, Sparkles,
} from 'lucide-react'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/bricolage-grotesque'
import '../styles/panel.css'
import { hasSupabase } from '../lib/supabase'
import { applyPalette } from '../lib/color'
import { store, money } from '../lib/format'
import { copyText } from '../lib/clipboard'
import Sheet from '../components/Sheet'
import * as api from './api'
import { enablePwa } from '../lib/pwa'
import { Text, Area, Select, Toggle, Money, Field, Empty, Banner } from './ui'
import { ThemeButton, useCollapsed, InstallButton } from './PanelApp'

const PLANS = [
  { value: 'mensual', label: 'Mensual', days: 30 },
  { value: 'trimestral', label: 'Trimestral', days: 90 },
  { value: 'semestral', label: 'Semestral', days: 180 },
  { value: 'anual', label: 'Anual', days: 365 },
  { value: 'personalizado', label: 'Personalizado', days: 30 },
  { value: 'demo', label: 'Demostración', days: 7 },
]
const planLabel = v => PLANS.find(p => p.value === v)?.label || v
const fmt = d => new Date(d).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
const ACTION = { alta: 'Alta', renovacion: 'Renovación', ajuste: 'Ajuste', suspension: 'Suspensión', reactivacion: 'Reactivación' }
const DEFAULT_RENEWAL = 'Hola {nombre} 👋 Te escribo de C-Stream. Tu catálogo *{negocio}* vence el *{fecha}* (quedan {dias} días). ¿Lo renovamos para que siga en línea sin cortes? 🙌\n{enlace}'
const slugify = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

export function stateOf(t) {
  if (t.status !== 'active') return { k: 'off', label: 'Suspendido' }
  if (t.days_left <= 0) return { k: 'past', label: 'Vencido' }
  if (t.days_left <= 7) return { k: 'warn', label: `Vence en ${t.days_left} ${t.days_left === 1 ? 'día' : 'días'}` }
  return { k: 'on', label: `${t.days_left} días` }
}

export default function AdminApp() {
  useEffect(() => {
    document.documentElement.dataset.panel = '1'
    enablePwa()
    document.documentElement.dataset.theme = store.get('cs-panel-theme') === 'dark' ? 'dark' : 'light'
    applyPalette(document.documentElement, '#FF6B35') // color de C-Stream, no el de un dueño
  }, [])
  const nav = useNavigate()
  const [st, setSt] = useState({ status: 'loading' })
  const [toastMsg, setToastMsg] = useState(null)
  const toast = useCallback((msg, tone = 'ok') => { setToastMsg({ msg, tone, k: Date.now() }); clearTimeout(toast.t); toast.t = setTimeout(() => setToastMsg(null), 2400) }, [])

  const load = useCallback(async () => {
    try {
      const me = await api.loadMe()
      if (!me) { nav('/entrar', { replace: true }); return }
      if (me?.profile?.role !== 'superadmin') { nav('/panel', { replace: true }); return }
      const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0)
      const [tenants, settings, log, pending] = await Promise.all([api.listTenantsAdmin(), api.adminSettings(), api.adminLogAll(since.toISOString()), api.adminRpc('admin_pending_owners')])
      setSt({ status: 'ready', me, tenants, settings: settings || {}, log, pending: pending || [] })
    } catch (e) { setSt({ status: 'error', error: api.niceError(e) }) }
  }, [nav])
  useEffect(() => { load() }, [load])

  if (!hasSupabase) return <Navigate to="/panel" replace />
  if (st.status === 'loading') return <div className="pgate"><Loader2 className="spin" size={28} /></div>
  if (st.status === 'error') return <div className="pgate"><div className="pgate__card"><span className="pgate__ic is-danger"><ShieldAlert size={26} /></span><h1>No pudimos abrir tu panel</h1><p>{st.error}</p><button className="key key--accent key--lg" onClick={load}>Reintentar</button></div></div>
  const ctx = { ...st, reload: load, toast }
  return (
    <>
      <AdminLayout ctx={ctx} />
      {toastMsg && <div key={toastMsg.k} className={`toast toast--${toastMsg.tone}`} role="status">{toastMsg.tone === 'ok' && <Check size={16} />}{toastMsg.msg}</div>}
    </>
  )
}

function AdminLayout({ ctx }) {
  const [menu, setMenu] = useState(false)
  const [collapsed, toggleCollapsed] = useCollapsed()
  const NAVS = [['', 'Resumen', LayoutDashboard], ['catalogos', 'Catálogos', Store], ['ajustes', 'Ajustes', Settings2]]
  const nav = (
    <nav className="pnav" aria-label="Secciones del superadmin">
      {NAVS.map(([to, l, I]) => <NavLink key={to} to={`/admin/${to}`} end={to === ''} className="pnav__item" title={l} onClick={() => setMenu(false)}><I size={18} /><span>{l}</span></NavLink>)}
    </nav>
  )
  const brand = <div className="pside__brand"><span className="pside__ph pside__ph--admin">C</span><div><b>C-Stream</b><small>Superadmin</small></div></div>
  const foot = (
    <div className="pside__foot">
      <InstallButton />
      <ThemeButton block />
      <button className="key key--sm key--ghost key--block" onClick={() => api.signOut().then(() => location.assign('/entrar'))} title="Salir"><LogOut size={15} /> <span>Salir</span></button>
    </div>
  )
  return (
    <div className="pshell">
      <aside className="pside">
        <button className="pside__collapse" onClick={toggleCollapsed} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}>{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button>
        {brand}{nav}{foot}
      </aside>
      <header className="ptop">
        <button className="key key--icon" onClick={() => setMenu(true)} aria-label="Abrir menú"><Menu size={19} /></button>
        <b>Superadmin</b><ThemeButton />
      </header>
      <Sheet open={menu} onClose={() => setMenu(false)} title="Menú" variant="drawer">{brand}{nav}{foot}</Sheet>
      <main className="pmain">
        <Routes>
          <Route index element={<Resumen ctx={ctx} />} />
          <Route path="catalogos" element={<Catalogos ctx={ctx} />} />
          <Route path="ajustes" element={<Ajustes ctx={ctx} />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function Head({ title, text, actions }) {
  return <div className="phead"><div><h1>{title}</h1>{text && <p>{text}</p>}</div>{actions && <div className="phead__acts">{actions}</div>}</div>
}

// Mensaje de renovación por WhatsApp al contacto del dueño
function renewalLink(t, tpl) {
  const phone = String(t.contact_phone || '').replace(/\D/g, '')
  if (!phone) return null
  const txt = (tpl || DEFAULT_RENEWAL)
    .replaceAll('{nombre}', t.contact_name || '')
    .replaceAll('{negocio}', t.name)
    .replaceAll('{fecha}', fmt(t.expires_at))
    .replaceAll('{dias}', String(Math.max(0, t.days_left)))
    .replaceAll('{enlace}', `${location.origin}/c/${t.slug}`)
  return `https://api.whatsapp.com/send?phone=${phone.length === 9 ? `51${phone}` : phone}&text=${encodeURIComponent(txt)}`
}

function Pending({ ctx, onActivate }) {
  const { pending, reload, toast } = ctx
  if (!pending?.length) return null
  return (
    <section className="pcard pcard--pending">
      <div className="pcard__head"><h2>Solicitudes nuevas <span className="ppill tnum">{pending.length}</span></h2></div>
      <p className="pmuted" style={{ marginBottom: 10 }}>Personas que se registraron y esperan que actives su catálogo.</p>
      <ul className="prows prows--flat">
        {pending.map(u => (
          <li key={u.email} className="prow">
            <div className="prow__main"><b>{u.business_name || 'Sin nombre de negocio'}</b><small>{u.full_name || '—'} · {u.email}{u.phone ? ` · +${u.phone}` : ''} · {fmt(u.created_at)}</small></div>
            {u.phone && <a className="key key--icon key--sm key--wa" href={`https://api.whatsapp.com/send?phone=${u.phone}`} target="_blank" rel="noopener noreferrer" aria-label="Escribir por WhatsApp"><MessageCircle size={15} /></a>}
            <button className="key key--sm key--ghost" onClick={async () => { try { await api.adminRpc('admin_dismiss_owner', { p_email: u.email }); await reload(); toast('Solicitud descartada') } catch (e) { toast(api.niceError(e), 'error') } }}>Descartar</button>
            <button className="key key--sm key--accent" onClick={() => onActivate(u)}><Check size={15} /> Activar</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Resumen({ ctx }) {
  const [act, setAct] = useState(null)
  const { tenants, log, settings } = ctx
  const active = tenants.filter(t => stateOf(t).k === 'on' || stateOf(t).k === 'warn')
  const soon = tenants.filter(t => stateOf(t).k === 'warn')
  const past = tenants.filter(t => stateOf(t).k === 'past')
  const income = log.reduce((a, l) => a + Number(l.amount || 0), 0)
  const renewals = log.filter(l => l.action === 'renovacion').length
  return (
    <>
      <Head title="Resumen" text="Así va tu negocio de catálogos este mes." />
      <div className="pstats pstats--admin">
        <div><Store size={17} /><b className="tnum">{active.length}</b><small>catálogos activos</small></div>
        <div className={soon.length ? 'is-warn' : ''}><CalendarPlus size={17} /><b className="tnum">{soon.length}</b><small>vencen en 7 días</small></div>
        <div className={past.length ? 'is-danger' : ''}><ShieldAlert size={17} /><b className="tnum">{past.length}</b><small>vencidos</small></div>
        <div><Sparkles size={17} /><b className="tnum">{money(income)}</b><small>cobrado este mes · {renewals} renovaciones</small></div>
      </div>
      <div style={{ marginTop: 14 }}><Pending ctx={ctx} onActivate={setAct} /></div>
      <NewTenant ctx={ctx} open={!!act} prefill={act} onClose={() => setAct(null)} />
      <section className="pcard">
        <div className="pcard__head"><h2>Por renovar</h2><NavLink to="/admin/catalogos" className="link-btn">Ver todos</NavLink></div>
        {[...soon, ...past].length === 0 ? <p className="pmuted">Nadie vence en los próximos 7 días. 🎉</p> : (
          <ul className="prows prows--flat">
            {[...soon, ...past].map(t => {
              const s = stateOf(t), wa = renewalLink(t, settings.renewal_template)
              return (
                <li key={t.id} className="prow">
                  <div className="prow__main"><b>{t.name}<span className={`ptag ptag--${s.k}`}>{s.label}</span></b><small>{t.contact_name || 'Sin contacto'} · vence {fmt(t.expires_at)}</small></div>
                  {wa ? <a className="key key--sm key--wa" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Avisar</a> : <span className="pmuted">Sin teléfono</span>}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

function Catalogos({ ctx }) {
  const { tenants } = ctx
  const [q, setQ] = useState('')
  const [f, setF] = useState('all')
  const [open, setOpen] = useState(null)
  const [creating, setCreating] = useState(false)
  const [prefill, setPrefill] = useState(null)
  const list = tenants.filter(t => (f === 'all' || stateOf(t).k === f) && (!q || `${t.name} ${t.slug} ${t.contact_name || ''} ${t.owner_email || ''}`.toLowerCase().includes(q.toLowerCase())))
  const current = open && tenants.find(t => t.id === open)
  return (
    <>
      <Head title="Catálogos" text="Tus clientes: días, pagos, contacto y acceso al panel de cada uno."
        actions={<button className="key key--accent" onClick={() => setCreating(true)}><Plus size={17} /> Nuevo catálogo</button>} />
      <Pending ctx={ctx} onActivate={u => { setPrefill(u); setCreating(true) }} />
      <div className="ptools">
        <div className="psearch"><Search size={17} /><input className="pin" placeholder="Buscar por nombre, slug, contacto o correo" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar catálogo" /></div>
        <div className="pseg" role="group" aria-label="Filtrar">
          {[['all', 'Todos'], ['on', 'Al día'], ['warn', 'Por vencer'], ['past', 'Vencidos'], ['off', 'Suspendidos']].map(([k, l]) => <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}
        </div>
      </div>
      {list.length === 0 ? <Empty icon={<Store size={22} />} title="Sin resultados" text="Crea tu primer catálogo o cambia el filtro." /> : (
        <ul className="prows">
          {list.map(t => {
            const s = stateOf(t)
            return (
              <li key={t.id} className={`prow${s.k === 'off' || s.k === 'past' ? ' is-off' : ''}`}>
                <span className={`pdays-pill pdays-pill--${s.k} tnum`}><b>{Math.max(0, t.days_left)}</b><small>días</small></span>
                <button className="prow__main" onClick={() => setOpen(t.id)}>
                  <b>{t.name}<span className="ptag is-muted">/{t.slug}</span><span className={`ptag ptag--${s.k}`}>{s.label}</span></b>
                  <small>{planLabel(t.plan)} · vence {fmt(t.expires_at)} · {t.owner_email || 'sin dueño vinculado'}</small>
                </button>
                <button className="key key--sm" onClick={() => setOpen(t.id)}><Pencil size={15} /> Gestionar</button>
              </li>
            )
          })}
        </ul>
      )}
      <TenantSheet ctx={ctx} t={current} onClose={() => setOpen(null)} />
      <NewTenant ctx={ctx} open={creating} prefill={prefill} onClose={() => { setCreating(false); setPrefill(null) }} />
    </>
  )
}

function TenantSheet({ ctx, t, onClose }) {
  const { reload, toast, settings } = ctx
  const [tab, setTab] = useState('dias')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState(null)
  const [days, setDays] = useState({ plan: 'mensual', n: '30', amount: '', note: '', mode: 'add', date: '' })
  const [log, setLog] = useState(null)
  const [email, setEmail] = useState('')
  const [delSlug, setDelSlug] = useState('')
  useEffect(() => {
    if (!t) return
    setInfo({ name: t.name, plan: t.plan, contact_name: t.contact_name || '', contact_phone: t.contact_phone || '', notes: t.notes || '', show_credit: t.show_credit })
    const pl = PLANS.find(p => p.value === (t.plan === 'demo' ? 'mensual' : t.plan)) || PLANS[0]
    setDays({ plan: pl.value, n: String(pl.days), amount: t.amount_paid != null ? String(t.amount_paid) : '', note: '', mode: 'add', date: t.expires_at.slice(0, 10) })
    setLog(null); setDelSlug(''); setEmail('')
  }, [t?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (t && tab === 'historial' && !log) api.adminRpc('admin_tenant_log', { p_tenant: t.id }).then(setLog).catch(e => toast(api.niceError(e), 'error')) }, [tab, t, log, toast])
  if (!t || !info) return <Sheet open={false} onClose={onClose} />

  const run = async (fn, okMsg) => { setBusy(true); try { await fn(); await reload(); toast(okMsg); setLog(null) } catch (e) { toast(api.niceError(e), 'error') } finally { setBusy(false) } }
  const n = Number(days.n) || 0
  const newExp = (() => {
    const base = days.mode === 'reset' ? new Date() : new Date(Math.max(Date.now(), new Date(t.expires_at)))
    return new Date(base.getTime() + n * 864e5)
  })()
  const applyDays = () => run(async () => {
    if (days.mode === 'date') await api.adminRpc('admin_set_expiry', { p_tenant: t.id, p_expires: new Date(`${days.date}T23:59:00`).toISOString(), p_note: days.note || 'Fecha editada' })
    else if (days.mode === 'reset') await api.adminRpc('admin_set_expiry', { p_tenant: t.id, p_expires: newExp.toISOString(), p_note: days.note || `Reinicio: ${n} días desde hoy` })
    else await api.adminRpc('admin_add_days', { p_tenant: t.id, p_days: days.mode === 'sub' ? -n : n, p_amount: days.amount === '' ? null : Number(days.amount), p_note: days.note || null })
    if (days.plan !== t.plan) await api.adminRpc('admin_update_tenant', { p_tenant: t.id, p: { plan: days.plan } })
  }, 'Días actualizados')
  const wa = renewalLink(t, settings.renewal_template)
  const s = stateOf(t)
  const TABS = [['dias', 'Días y pagos'], ['datos', 'Datos'], ['ia', 'Asistente IA'], ['acceso', 'Acceso'], ['historial', 'Historial']]

  return (
    <Sheet open={!!t} onClose={onClose} variant="drawer" title={t.name} wide>
      <div className="tsum">
        <span className={`pdays-pill pdays-pill--${s.k} tnum`}><b>{Math.max(0, t.days_left)}</b><small>días</small></span>
        <div><b>{s.label}</b><small>{planLabel(t.plan)} · vence {fmt(t.expires_at)}</small></div>
      </div>
      <div className="tacts">
        <button className="key key--sm key--accent" onClick={() => { store.set('cs-admin-tenant', t.id); location.assign('/panel') }}><Store size={15} /> Editar su catálogo</button>
        <a className="key key--sm" href={`/c/${t.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> Ver</a>
        {wa && <a className="key key--sm key--wa" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Recordar pago</a>}
      </div>
      <div className="ttabs" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'dias' && <div className="pfields">
        <Field label="¿Qué quieres hacer?" wide>
          <div className="pseg pseg--wrap" role="group">
            {[['add', 'Sumar días'], ['reset', 'Reiniciar desde hoy'], ['sub', 'Restar días'], ['date', 'Fecha exacta']].map(([k, l]) => <button key={k} aria-pressed={days.mode === k} onClick={() => setDays(d => ({ ...d, mode: k }))}>{l}</button>)}
          </div>
        </Field>
        {days.mode !== 'date' ? <>
          <Select label="Plan" value={days.plan} onChange={v => setDays(d => ({ ...d, plan: v, n: String(PLANS.find(p => p.value === v)?.days || d.n) }))} options={PLANS.map(p => ({ value: p.value, label: `${p.label}${p.value !== 'personalizado' ? ` · ${p.days} días` : ''}` }))} />
          <Text label="Días" inputMode="numeric" value={days.n} onChange={v => setDays(d => ({ ...d, n: v.replace(/\D/g, '').slice(0, 4), plan: 'personalizado' }))} hint="Cada mes cuenta como 30 días." />
          {days.mode === 'add' && <Money label="Monto cobrado" value={days.amount} onChange={v => setDays(d => ({ ...d, amount: v }))} />}
          <Text label="Nota" value={days.note} onChange={v => setDays(d => ({ ...d, note: v }))} placeholder="Pagó por Yape" />
          <div className="tpreview pf--wide">Nuevo vencimiento: <b>{days.mode === 'sub' ? fmt(new Date(new Date(t.expires_at).getTime() - n * 864e5)) : fmt(newExp)}</b>
            {days.mode === 'add' && t.days_left > 0 && <small> · se suman a los {t.days_left} días que le quedan</small>}</div>
        </> : <>
          <Text label="Vence el" type="date" value={days.date} onChange={v => setDays(d => ({ ...d, date: v }))} />
          <Text label="Nota" value={days.note} onChange={v => setDays(d => ({ ...d, note: v }))} />
        </>}
        <button className="key key--accent key--lg pf--wide" onClick={applyDays} disabled={busy || (days.mode !== 'date' && !n)}>{busy ? <Loader2 className="spin" size={17} /> : <CalendarPlus size={17} />} Aplicar</button>
        <div className="pf--wide">
          {t.status === 'active'
            ? <button className="key key--sm key--ghost" onClick={() => run(() => api.adminRpc('admin_set_status', { p_tenant: t.id, p_status: 'suspended', p_note: 'Suspendido desde el panel' }), 'Catálogo suspendido')} disabled={busy}>Suspender catálogo</button>
            : <button className="key key--sm" onClick={() => run(() => api.adminRpc('admin_set_status', { p_tenant: t.id, p_status: 'active', p_note: 'Reactivado desde el panel' }), 'Catálogo reactivado')} disabled={busy}>Reactivar catálogo</button>}
        </div>
      </div>}

      {tab === 'datos' && <div className="pfields">
        <Text label="Nombre" value={info.name} onChange={v => setInfo(i => ({ ...i, name: v }))} max={60} wide />
        <Text label="Contacto" value={info.contact_name} onChange={v => setInfo(i => ({ ...i, contact_name: v }))} />
        <Text label="Teléfono (WhatsApp)" inputMode="tel" value={info.contact_phone} onChange={v => setInfo(i => ({ ...i, contact_phone: v }))} placeholder="51999888777" />
        <Area label="Notas privadas" hint="Solo tú las ves." value={info.notes} onChange={v => setInfo(i => ({ ...i, notes: v }))} max={500} />
        <Toggle label="Mostrar “Catálogo hecho con C-Stream”" hint="Apagado por defecto." checked={info.show_credit} onChange={v => setInfo(i => ({ ...i, show_credit: v }))} />
        <button className="key key--accent key--lg pf--wide" disabled={busy} onClick={() => run(() => api.adminRpc('admin_update_tenant', { p_tenant: t.id, p: info }), 'Datos guardados')}>{busy ? <Loader2 className="spin" size={17} /> : <Check size={17} />} Guardar datos</button>
      </div>}

      {tab === 'acceso' && <div className="pfields">
        <div className="pf--wide">
          <p className="pf__label">Dueño vinculado</p>
          {t.owner_email ? t.owner_email.split(', ').map(e => (
            <div key={e} className="tline"><span>{e}</span><button className="key key--sm key--ghost" onClick={() => run(() => api.adminRpc('admin_unlink_owner', { p_email: e }), 'Dueño desvinculado')} disabled={busy}><Unlink size={14} /> Desvincular</button></div>
          )) : <p className="pmuted">Nadie todavía.</p>}
        </div>
        <Text label="Vincular una cuenta" type="email" value={email} onChange={setEmail} placeholder="dueno@gmail.com" hint="La persona debe crear su cuenta primero en /registro (o la creas tú en Supabase → Authentication)." />
        <button className="key pf--wide" onClick={() => run(() => api.adminRpc('admin_link_owner', { p_slug: t.slug, p_email: email }), 'Cuenta vinculada')} disabled={busy || !email.includes('@')}><Link2 size={16} /> Vincular</button>
        <div className="tseed pf--wide">
          <div><b>Plataformas y bancos sugeridos</b><small>Agrega lo que falte de la biblioteca (apagado, con logo y textos) y los bancos con su logo. No duplica ni toca lo que ya tiene.</small></div>
          <button className="key key--sm" disabled={busy} onClick={() => run(async () => { const r = await api.adminRpc('admin_seed_defaults', { p_tenant: t.id }); toast(`Agregado: ${r.platforms} plataformas, ${r.payments} métodos de pago`) }, 'Listo')}><Sparkles size={15} /> Cargar sugeridos</button>
        </div>
        <div className="tline pf--wide"><span>{location.origin}/c/{t.slug}</span><button className="key key--sm" onClick={async () => { if (await copyText(`${location.origin}/c/${t.slug}`)) toast('Enlace copiado') }}><Copy size={14} /> Copiar</button></div>
        <div className="tdanger pf--wide">
          <b>Borrar catálogo</b><p className="pmuted">Se borra todo: plataformas, precios, avisos e imágenes vinculadas. Escribe <code>{t.slug}</code> para confirmar.</p>
          <div className="pauto__row"><input className="pin" value={delSlug} onChange={e => setDelSlug(e.target.value)} aria-label="Escribe el slug para confirmar" />
            <button className="key key--danger" disabled={delSlug !== t.slug || busy} onClick={() => run(async () => { await api.adminRpc('admin_delete_tenant', { p_tenant: t.id, p_confirm_slug: delSlug }); onClose() }, 'Catálogo borrado')}><Trash2 size={15} /> Borrar</button></div>
        </div>
      </div>}

      {tab === 'ia' && <AiTab t={t} toast={toast} />}

      {tab === 'historial' && (log === null ? <div className="pload"><Loader2 className="spin" size={22} /></div> : log.length === 0 ? <p className="pmuted">Sin movimientos.</p> : (
        <ul className="tlog">
          {log.map(l => (
            <li key={l.id}><History size={15} /><div><b>{ACTION[l.action] || l.action}{l.days_delta ? ` · ${l.days_delta > 0 ? '+' : ''}${l.days_delta} días` : ''}{l.amount ? ` · ${money(l.amount)}` : ''}</b><small>{fmt(l.created_at)}{l.note ? ` · ${l.note}` : ''}</small></div></li>
          ))}
        </ul>
      ))}
    </Sheet>
  )
}

const MODELS = [
  { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite · el más económico (recomendado)' },
  { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash · más inteligente, gasta más cuota' },
]
function AiTab({ t, toast }) {
  const [st, setSt] = useState(null)
  const [f, setF] = useState(null)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [test, setTest] = useState(null)
  const load = useCallback(async () => {
    try {
      const r = await api.adminRpc('admin_ai_status', { p_tenant: t.id })
      setSt(r || {}); setF({ label_email: r?.label_email || '', model: r?.model || 'gemini-3.5-flash-lite', daily_limit: String(r?.daily_limit ?? 200), per_visitor_limit: String(r?.per_visitor_limit ?? 20), web_search: r?.web_search !== false })
    } catch (e) { toast(api.niceError(e), 'error') }
  }, [t.id, toast])
  useEffect(() => { load() }, [load])
  if (!f) return <div className="pload"><Loader2 className="spin" size={22} /></div>
  const save = async (extra = {}) => {
    setBusy(true); setTest(null)
    try {
      await api.invokeLu({ action: 'admin_save', tenant_id: t.id, label_email: f.label_email, model: f.model, web_search: f.web_search, daily_limit: Number(f.daily_limit) || 0, per_visitor_limit: Math.max(1, Number(f.per_visitor_limit) || 1), ...(key.trim() ? { api_key: key.trim() } : {}), ...extra })
      setKey(''); await load(); toast(extra.remove_key ? 'Clave quitada' : 'Asistente guardado')
    } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  const probe = async () => {
    setBusy(true); setTest(null)
    try { const r = await api.invokeLu({ action: 'admin_test', tenant_id: t.id }); setTest({ ok: true, text: `${r.reply} · ${r.ms} ms · ${r.model}`, web: r.web }) }
    catch (e) { setTest({ ok: false, text: e.message }) } finally { setBusy(false) }
  }
  const pct = Math.min(100, ((st.today || 0) / Math.max(1, Number(f.daily_limit))) * 100)
  return (
    <div className="pfields">
      <div className={`tai pf--wide${st.has_key ? ' is-on' : ''}`}>
        <span className="tai__dot" />
        <div><b>{st.has_key ? `Clave guardada · termina en ••••${st.key_last4}` : 'Sin clave: el asistente no aparece en este catálogo'}</b>
          <small>Hoy: {st.today || 0} de {f.daily_limit} respuestas</small>
          <div className="pbar"><span style={{ width: `${pct}%` }} /></div></div>
      </div>
      <Text label="Gmail de esta clave (referencia)" type="email" value={f.label_email} onChange={v => setF(o => ({ ...o, label_email: v }))} placeholder="cstream.bot1@gmail.com" hint="Solo para que sepas qué cuenta es. No guardes la contraseña del Gmail aquí." wide />
      <Field label={st.has_key ? 'Reemplazar clave de Gemini' : 'Clave de Gemini (API key)'} hint="Créala en aistudio.google.com con ese Gmail. Se cifra en el servidor y nunca vuelve a mostrarse." wide>
        <input className="pin" type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder="AIza… o AQ.…" aria-label="Clave de Gemini" />
      </Field>
      <Select label="Modelo" value={f.model} onChange={v => setF(o => ({ ...o, model: v }))} options={MODELS} wide />
      <Text label="Respuestas por día (catálogo)" inputMode="numeric" value={f.daily_limit} onChange={v => setF(o => ({ ...o, daily_limit: v.replace(/\D/g, '').slice(0, 5) }))} hint="Mantenlo bajo el límite gratis de tu clave. 0 apaga el asistente." />
      <Text label="Mensajes por cliente al día" inputMode="numeric" value={f.per_visitor_limit} onChange={v => setF(o => ({ ...o, per_visitor_limit: v.replace(/\D/g, '').slice(0, 4) }))} hint="Evita que una sola persona gaste la cuota." />
      <Toggle label="Decir dónde ver películas y series" hint="Cuando un cliente pregunta por un título, Lu consulta TMDB (plataformas en Perú) y recomienda las que vende este catálogo. Usa tu clave TMDB_KEY de Supabase, no la de Gemini." checked={f.web_search} onChange={v => setF(o => ({ ...o, web_search: v }))} />
      <button className="key key--accent key--lg pf--wide" onClick={() => save()} disabled={busy}>{busy ? <Loader2 className="spin" size={17} /> : <Check size={17} />} Guardar</button>
      {st.has_key && <div className="pf--wide tacts" style={{ margin: 0 }}>
        <button className="key key--sm" onClick={probe} disabled={busy}><Sparkles size={15} /> Probar conexión</button>
        <button className="key key--sm key--ghost" onClick={() => save({ remove_key: true })} disabled={busy}><Trash2 size={15} /> Quitar clave</button>
      </div>}
      {test && <div className={`pbanner pbanner--${test.ok ? 'info' : 'danger'} pf--wide`}>{test.ok ? <Check size={18} /> : <ShieldAlert size={18} />}<div>
        <b>{test.ok ? 'Conexión correcta' : 'No se pudo conectar'}</b><br />{test.text}
        {test.web && <><br /><b>Dónde ver (TMDB):</b> {test.web === 'sin_clave' ? 'falta el secreto TMDB_KEY en Supabase (Edge Functions → Secrets). Lu responde igual, sin buscar títulos.' : test.web.startsWith('ok') ? `funcionando ✓${test.web.length > 3 ? ` · prueba: ${test.web.slice(3)}` : ''}` : `${test.web}. Revisa que TMDB_KEY sea el token de lectura completo.`}</>}
      </div></div>}
    </div>
  )
}

function NewTenant({ ctx, open, onClose, prefill }) {
  const { reload, toast } = ctx
  const blank = { name: '', slug: '', plan: 'mensual', days: '30', amount: '', contact_name: '', contact_phone: '', email: '' }
  const [f, setF] = useState(blank)
  const [auto, setAuto] = useState(true)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setAuto(true)
    setF(prefill ? { ...blank, name: prefill.business_name || '', slug: slugify(prefill.business_name || prefill.email.split('@')[0]), contact_name: prefill.full_name || '', contact_phone: prefill.phone || '', email: prefill.email } : blank)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const valid = f.name.trim().length >= 2 && /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(f.slug) && Number(f.days) > 0
  const create = async () => {
    setBusy(true)
    try {
      await api.adminRpc('admin_create_tenant', { p_slug: f.slug, p_name: f.name.trim(), p_plan: f.plan, p_days: Number(f.days), p_contact_name: f.contact_name || null, p_contact_phone: f.contact_phone || null, p_amount: f.amount === '' ? null : Number(f.amount) })
      if (f.email.includes('@')) {
        try { await api.adminRpc('admin_link_owner', { p_slug: f.slug, p_email: f.email }) }
        catch (e) { toast(`Catálogo creado, pero no se vinculó la cuenta: ${api.niceError(e)}`, 'warn') }
      }
      await reload(); toast(`Catálogo /c/${f.slug} creado`); onClose()
    } catch (e) { toast(/duplicate/i.test(e.message) ? 'Ese slug ya existe' : api.niceError(e), 'error') } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} variant="drawer" title={prefill ? 'Activar catálogo' : 'Nuevo catálogo'}
      footer={<button className="key key--accent key--block key--lg" disabled={!valid || busy} onClick={create}>{busy ? <Loader2 className="spin" size={17} /> : <Plus size={17} />} Crear catálogo</button>}>
      <div className="pfields">
        <Text label="Nombre del negocio" value={f.name} onChange={v => setF(o => ({ ...o, name: v, slug: auto ? slugify(v) : o.slug }))} max={60} wide />
        <Text label="Enlace" value={f.slug} onChange={v => { setAuto(false); setF(o => ({ ...o, slug: slugify(v) })) }} hint={`Quedará: ${location.host}/c/${f.slug || 'nombre'}`} wide />
        <Select label="Plan" value={f.plan} onChange={v => setF(o => ({ ...o, plan: v, days: String(PLANS.find(p => p.value === v)?.days || o.days) }))} options={PLANS.map(p => ({ value: p.value, label: p.label }))} />
        <Text label="Días" inputMode="numeric" value={f.days} onChange={v => setF(o => ({ ...o, days: v.replace(/\D/g, '').slice(0, 4) }))} />
        <Money label="Monto cobrado" value={f.amount} onChange={v => setF(o => ({ ...o, amount: v }))} />
        <Text label="Contacto" value={f.contact_name} onChange={v => setF(o => ({ ...o, contact_name: v }))} />
        <Text label="Teléfono (WhatsApp)" inputMode="tel" value={f.contact_phone} onChange={v => setF(o => ({ ...o, contact_phone: v }))} placeholder="51999888777" />
        <Text label="Correo del dueño (opcional)" type="email" value={f.email} onChange={v => setF(o => ({ ...o, email: v }))} hint="Si ya creaste su cuenta en Supabase, se vincula de una vez." />
        <p className="pmuted pf--wide">Se crea con 3 duraciones, 5 categorías y el asistente Lu listos. El dueño completa lo demás desde su panel.</p>
      </div>
    </Sheet>
  )
}

function Ajustes({ ctx }) {
  const { settings, toast, reload } = ctx
  const [tpl, setTpl] = useState(settings.renewal_template || DEFAULT_RENEWAL)
  const [busy, setBusy] = useState(false)
  const sample = useMemo(() => renewalLink({ name: 'Tienda Ejemplo', slug: 'tienda-ejemplo', contact_name: 'Ana', contact_phone: '51999888777', expires_at: new Date(Date.now() + 5 * 864e5).toISOString(), days_left: 5 }, tpl), [tpl])
  const text = decodeURIComponent(sample.split('&text=')[1] || '')
  return (
    <>
      <Head title="Ajustes" text="Tu mensaje de renovación y lo que llega en las próximas entregas." />
      <div className="psplit psplit--even">
        <section className="pcard">
          <h2 className="pcard__title">Mensaje de renovación</h2>
          <p className="pmuted" style={{ marginBottom: 10 }}>Se abre en WhatsApp al tocar “Avisar” o “Recordar pago”. Variables: {'{nombre} {negocio} {fecha} {dias} {enlace}'}</p>
          <textarea className="pin pin--area" rows={7} value={tpl} onChange={e => setTpl(e.target.value)} aria-label="Plantilla del mensaje de renovación" />
          <div className="pcard__foot">
            <button className="key key--sm key--ghost" onClick={() => setTpl(DEFAULT_RENEWAL)}>Usar el sugerido</button>
            <button className="key key--accent" disabled={busy} onClick={async () => { setBusy(true); try { await api.saveAdminSettings({ renewal_template: tpl }); await reload(); toast('Mensaje guardado') } catch (e) { toast(api.niceError(e), 'error') } finally { setBusy(false) } }}>{busy ? <Loader2 className="spin" size={16} /> : <Check size={16} />} Guardar</button>
          </div>
        </section>
        <section className="pcard"><h2 className="pcard__title">Así llega (ejemplo)</h2><div className="preview pwa">{text}</div></section>
      </div>
    </>
  )
}
