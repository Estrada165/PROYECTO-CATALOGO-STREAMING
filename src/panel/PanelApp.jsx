import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  Home, Palette, LayoutGrid, Clock3, Boxes, Percent, Wallet, Megaphone, FileText, Bot, LogOut, ExternalLink,
  Menu, Check, Loader2, ShieldAlert, KeyRound, ArrowLeft, Moon, Sun, PanelLeftClose, PanelLeftOpen, Download,
} from 'lucide-react'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/bricolage-grotesque'
import '../styles/panel.css'
import { hasSupabase } from '../lib/supabase'
import { applyPalette } from '../lib/color'
import { store } from '../lib/format'
import { switchTheme } from '../lib/motion'
import Sheet from '../components/Sheet'
import * as api from './api'
import { enablePwa, useInstall } from '../lib/pwa'
import { Dropdown } from './ui'

const Inicio = lazy(() => import('./sections/Inicio'))
const Marca = lazy(() => import('./sections/Marca'))
const Plataformas = lazy(() => import('./sections/Plataformas'))
const Opciones = lazy(() => import('./sections/Opciones'))
const Combos = lazy(() => import('./sections/Combos'))
const Descuentos = lazy(() => import('./sections/Descuentos'))
const Pagos = lazy(() => import('./sections/Pagos'))
const Avisos = lazy(() => import('./sections/Avisos'))
const Textos = lazy(() => import('./sections/Textos'))
const Lu = lazy(() => import('./sections/Lu'))

const Ctx = createContext(null)
export const usePanel = () => useContext(Ctx)

export const NAV = [
  { to: '', label: 'Inicio', icon: Home, el: <Inicio /> },
  { to: 'marca', label: 'Marca y contacto', icon: Palette, el: <Marca /> },
  { to: 'plataformas', label: 'Plataformas y precios', icon: LayoutGrid, el: <Plataformas /> },
  { to: 'opciones', label: 'Duraciones y categorías', icon: Clock3, el: <Opciones /> },
  { to: 'combos', label: 'Combos', icon: Boxes, el: <Combos /> },
  { to: 'descuentos', label: 'Descuentos', icon: Percent, el: <Descuentos /> },
  { to: 'pagos', label: 'Métodos de pago', icon: Wallet, el: <Pagos /> },
  { to: 'avisos', label: 'Avisos', icon: Megaphone, el: <Avisos /> },
  { to: 'textos', label: 'Textos y ayuda', icon: FileText, el: <Textos /> },
  { to: 'lu', label: 'Asistente', icon: Bot, el: <Lu /> },
]

export default function PanelApp() {
  useEffect(() => {
    document.documentElement.dataset.panel = '1'
    enablePwa()
    const saved = store.get('cs-panel-theme')
    document.documentElement.dataset.theme = saved === 'dark' ? 'dark' : 'light'
    return () => { delete document.documentElement.dataset.panel }
  }, [])
  if (!hasSupabase) return <NoSupabase />
  return (
    <Routes>
      <Route path="entrar" element={<Navigate to="/entrar" replace />} />
      <Route path="clave" element={<Navigate to={`/clave${location.hash}`} replace />} />
      <Route path="*" element={<Shell />} />
    </Routes>
  )
}

function NoSupabase() {
  return (
    <div className="pgate">
      <div className="pgate__card">
        <span className="pgate__ic"><KeyRound size={26} /></span>
        <h1>Conecta Supabase para usar el panel</h1>
        <p>El catálogo de demostración funciona sin base de datos, pero el panel necesita guardar tus cambios.
          Crea el archivo <code>.env</code> con <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> y reinicia <code>npm run dev</code>.</p>
        <a className="key key--accent key--lg" href="/c/cstream">Ver el catálogo de demostración</a>
      </div>
    </div>
  )
}

function Shell() {
  const navigate = useNavigate()
  // navigate cambia en cada ruta: se guarda en una ref para no recargar el panel al navegar
  const navRef = useRef(navigate); navRef.current = navigate
  const nav = useCallback((...a) => navRef.current(...a), [])
  const [state, setState] = useState({ status: 'loading' })
  const [data, setData] = useState(null)
  const [toastMsg, setToastMsg] = useState(null)

  const toast = useCallback((msg, tone = 'ok') => {
    setToastMsg({ msg, tone, k: Date.now() })
    clearTimeout(toast.t); toast.t = setTimeout(() => setToastMsg(null), 2400)
  }, [])

  const boot = useCallback(async () => {
    try {
      const me = await api.loadMe()
      if (!me) { nav('/entrar', { replace: true }); return }
      if (!me?.profile) { setState({ status: 'error', error: 'Tu cuenta no tiene perfil. Escríbele al administrador.' }); return }
      const isAdmin = me.profile.role === 'superadmin'
      let tid = me.profile.tenant_id
      let tenants = null
      if (isAdmin) {
        // El superadmin solo entra aquí desde su panel, eligiendo un catálogo
        tenants = await api.listTenantsAdmin()
        tid = store.get('cs-admin-tenant')
        if (!tenants.some(t => t.id === tid)) { nav('/admin', { replace: true }); return }
      }
      if (!tid) { setState({ status: 'noTenant', me }); return }
      // El dueño ya trae su catálogo con el perfil: una consulta menos
      const [tenant, all] = await Promise.all([
        !isAdmin && me.profile.tenant?.id === tid ? me.profile.tenant : api.loadTenant(tid),
        api.loadAll(tid),
      ])
      setData(all)
      setState({ status: 'ready', me, tenant, isAdmin, tenants })
    } catch (e) {
      setState({ status: 'error', error: api.niceError(e) })
    }
  }, [nav])

  useEffect(() => { boot() }, [boot])
  useEffect(() => {
    let off = () => {}
    api.onAuth(ev => { if (ev === 'SIGNED_OUT') nav('/entrar', { replace: true }) }).then(f => { off = f })
    return () => off()
  }, [nav])

  // El panel toma el color del catálogo
  useEffect(() => { if (data?.settings?.accent) applyPalette(document.documentElement, data.settings.accent) }, [data?.settings?.accent])

  const tenant = state.tenant
  const expired = tenant ? (tenant.status !== 'active' || new Date(tenant.expires_at) <= new Date()) : false
  const canEdit = state.isAdmin || (tenant && !expired)

  // Actualiza una parte de los datos sin recargar todo
  const patch = useCallback((key, fn) => setData(d => ({ ...d, [key]: typeof fn === 'function' ? fn(d[key]) : fn })), [])
  const reload = useCallback(async () => { if (tenant) setData(await api.loadAll(tenant.id)) }, [tenant])

  const switchTenant = id => { store.set('cs-admin-tenant', id); setState({ status: 'loading' }); setData(null); boot() }

  const ctx = useMemo(() => ({
    ...state, tid: tenant?.id, data, patch, reload, toast, canEdit, expired, switchTenant,
    sym: data?.settings?.currency_symbol || 'S/',
  }), [state, tenant, data, patch, reload, toast, canEdit, expired]) // eslint-disable-line react-hooks/exhaustive-deps

  if (state.status === 'loading') return <div className="pgate"><Loader2 className="spin" size={28} /></div>
  if (state.status === 'error') return (
    <div className="pgate"><div className="pgate__card">
      <span className="pgate__ic is-danger"><ShieldAlert size={26} /></span>
      <h1>No pudimos abrir el panel</h1><p>{state.error}</p>
      <div className="row-2"><button className="key key--lg" onClick={() => api.signOut()}>Salir</button><button className="key key--accent key--lg" onClick={boot}>Reintentar</button></div>
    </div></div>
  )
  if (state.status === 'noTenant') return (
    <div className="pgate"><div className="pgate__card">
      <span className="pgate__ic"><KeyRound size={26} /></span>
      <h1>Tu cuenta está en revisión</h1>
      <p>¡Gracias por registrarte{state.me?.profile?.full_name ? `, ${state.me.profile.full_name.split(' ')[0]}` : ''}! En cuanto activemos tu catálogo{state.me?.profile?.business_name ? ` “${state.me.profile.business_name}”` : ''}, entrarás aquí con este mismo correo.</p>
      <a className="key key--wa key--lg" href={`https://api.whatsapp.com/send?phone=${import.meta.env.VITE_SUPPORT_WHATSAPP || '51904670421'}&text=${encodeURIComponent(`Hola 👋 Me registré en C-Stream con ${state.me?.profile?.email}. Quiero activar mi catálogo${state.me?.profile?.business_name ? ` “${state.me.profile.business_name}”` : ''}.`)}`} target="_blank" rel="noopener noreferrer">Avisar por WhatsApp</a>
      <button className="key key--lg" onClick={() => api.signOut()}><LogOut size={17} /> Salir</button>
    </div></div>
  )

  return (
    <Ctx.Provider value={ctx}>
      <Layout />
      {toastMsg && <div key={toastMsg.k} className={`toast toast--${toastMsg.tone}`} role="status">{toastMsg.tone === 'ok' && <Check size={16} />}{toastMsg.msg}</div>}
    </Ctx.Provider>
  )
}

// Tema claro/oscuro del panel (independiente del catálogo)
export function usePanelTheme() {
  const [t, setT] = useState(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  const toggle = el => {
    const n = t === 'dark' ? 'light' : 'dark'
    // Mismo círculo que en el catálogo
    switchTheme(n, el, x => { document.documentElement.dataset.theme = x; setT(x) })
    store.set('cs-panel-theme', n)
  }
  return [t, toggle]
}
export function ThemeButton({ block }) {
  const [t, toggle] = usePanelTheme()
  return <button className={`key key--sm${block ? ' key--block' : ' key--icon'}`} onClick={e => toggle(e.currentTarget)} aria-label={t === 'dark' ? 'Tema claro' : 'Tema oscuro'} title={t === 'dark' ? 'Tema claro' : 'Tema oscuro'}>
    {t === 'dark' ? <Sun size={15} /> : <Moon size={15} />}{block && <span>{t === 'dark' ? ' Tema claro' : ' Tema oscuro'}</span>}</button>
}
export function InstallButton() {
  const [can, install] = useInstall()
  if (!can) return null
  return <button className="key key--sm key--block key--install" onClick={install} title="Instalar app"><Download size={15} /> <span>Instalar app</span></button>
}

export function useCollapsed() {
  const [c, setC] = useState(() => store.get('cs-panel-collapsed') === true)
  useEffect(() => { document.documentElement.dataset.collapsed = c ? '1' : ''; store.set('cs-panel-collapsed', c) }, [c])
  return [c, () => setC(v => !v)]
}

function Layout() {
  const { data, tenant, isAdmin, tenants, switchTenant, expired } = usePanel()
  const [menu, setMenu] = useState(false)
  const [collapsed, toggleCollapsed] = useCollapsed()
  const loc = useLocation()
  useEffect(() => { setMenu(false); window.scrollTo(0, 0) }, [loc.pathname])
  const s = data.settings
  const days = Math.max(0, Math.ceil((new Date(tenant.expires_at) - new Date()) / 864e5))
  const current = NAV.find(n => (`/panel/${n.to}`).replace(/\/$/, '') === loc.pathname.replace(/\/$/, '')) || NAV[0]

  const nav = (
    <nav className="pnav" aria-label="Secciones del panel">
      {NAV.map(n => (
        <NavLink key={n.to} to={`/panel/${n.to}`} end={n.to === ''} className="pnav__item" title={n.label}>
          <n.icon size={18} /><span>{n.label}</span>
        </NavLink>
      ))}
    </nav>
  )
  const foot = (
    <div className="pside__foot">
      <div className={`pplan${expired ? ' is-expired' : days <= 7 ? ' is-warn' : ''}`}>
        <small>{expired ? 'Plan vencido' : 'Tu plan'}</small>
        <b className="tnum">{expired ? 'Solo lectura' : `${days} ${days === 1 ? 'día' : 'días'}`}</b>
      </div>
      <a className="key key--sm key--block" href={`/c/${tenant.slug}`} target="_blank" rel="noopener noreferrer" title="Ver mi catálogo"><ExternalLink size={15} /> <span>Ver mi catálogo</span></a>
      <InstallButton />
      <ThemeButton block />
      <button className="key key--sm key--ghost key--block" onClick={() => api.signOut()} title="Salir"><LogOut size={15} /> <span>Salir</span></button>
    </div>
  )
  const brand = (
    <div className="pside__brand">
      {s.logo_url ? <img src={s.logo_url} alt="" width="38" height="38" /> : <span className="pside__ph">{s.business_name?.[0]}</span>}
      <div><b>{s.business_name}</b><small>/c/{tenant.slug}</small></div>
    </div>
  )

  return (
    <div className="pshell">
      <aside className="pside">
        <button className="pside__collapse" onClick={toggleCollapsed} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'} title={collapsed ? 'Expandir menú' : 'Contraer menú'}>
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
        {brand}
        {isAdmin && (
          <div className="padmin">
            <small>Superadmin · editando como dueño</small>
            <Dropdown value={tenant.id} onChange={switchTenant} label="Catálogo que editas" options={tenants.map(t => ({ value: t.id, label: `${t.name} (${t.slug})` }))} />
            <a className="key key--sm key--block" href="/admin"><ArrowLeft size={15} /> Volver a mi panel</a>
          </div>
        )}
        {nav}{foot}
      </aside>
      <header className="ptop">
        <button className="key key--icon" onClick={() => setMenu(true)} aria-label="Abrir menú"><Menu size={19} /></button>
        <b>{current.label}</b>
        <ThemeButton />
        <a className="key key--icon" href={`/c/${tenant.slug}`} target="_blank" rel="noopener noreferrer" aria-label="Ver mi catálogo"><ExternalLink size={18} /></a>
      </header>
      <Sheet open={menu} onClose={() => setMenu(false)} title="Menú" variant="drawer">
        {brand}{nav}{foot}
      </Sheet>
      <main className="pmain">
        {expired && !isAdmin && (
          <div className="pbanner pbanner--danger pexpired" role="alert">
            <ShieldAlert size={18} />
            <div><b>Tu plan venció.</b> Tu catálogo está en mantenimiento y el panel quedó en solo lectura. No se perdió nada: al renovar, todo vuelve a estar igual.</div>
            <a className="key key--sm key--wa" href={`https://api.whatsapp.com/send?phone=${import.meta.env.VITE_SUPPORT_WHATSAPP || '51904670421'}&text=${encodeURIComponent(`Hola 👋 Quiero renovar mi catálogo ${s.business_name} (/c/${tenant.slug}).`)}`} target="_blank" rel="noopener noreferrer">Renovar</a>
          </div>
        )}
        <Suspense fallback={<div className="pload"><Loader2 className="spin" size={24} /></div>}>
          <Routes>
            {NAV.map(n => n.to === '' ? <Route key="home" index element={n.el} /> : <Route key={n.to} path={n.to} element={n.el} />)}
            <Route path="*" element={<Navigate to="/panel" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

// Encabezado común de cada sección
export function PageHead({ title, text, actions }) {
  return (
    <div className="phead">
      <div><h1>{title}</h1>{text && <p>{text}</p>}</div>
      {actions && <div className="phead__acts">{actions}</div>}
    </div>
  )
}
