import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, LogIn, Mail, Check, UserPlus, Store, Zap, ShieldCheck } from 'lucide-react'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/bricolage-grotesque'
import '../styles/panel.css'
import { hasSupabase } from '../lib/supabase'
import { store } from '../lib/format'
import * as api from './api'
import { enablePwa } from '../lib/pwa'

// Una sola puerta para todos: dueños y superadmin. El cliente final no necesita cuenta.
export default function AuthApp() {
  const loc = useLocation()
  useEffect(() => {
    document.documentElement.dataset.panel = '1'
    enablePwa()
    document.documentElement.dataset.theme = store.get('cs-panel-theme') === 'dark' ? 'dark' : 'light'
    // Se adelanta la descarga del panel mientras la persona escribe
    import('./PanelApp'); import('./sections/Inicio')
  }, [])
  if (!hasSupabase) return <Navigate to="/panel" replace />
  const path = loc.pathname.replace(/\/$/, '')
  if (path === '/clave') return <SetPassword />
  return <Auth mode={path === '/registro' ? 'signup' : 'login'} />
}

const homeFor = me => (me?.profile?.role === 'superadmin' ? '/admin' : '/panel')

function Shell({ children, wide }) {
  return (
    <div className="pgate pgate--login">
      <div className={`pauth${wide ? ' pauth--wide' : ''}`}>
        <aside className="pauth__side" aria-hidden="true">
          <div className="plogin__mark"><span /><span /><span /></div>
          <h2>Tu catálogo de streaming, listo para vender.</h2>
          <ul>
            <li><Store size={17} /> Tu marca, tus precios y tus combos</li>
            <li><Zap size={17} /> Pedidos directo a tu WhatsApp</li>
            <li><ShieldCheck size={17} /> Cada catálogo, privado y seguro</li>
          </ul>
        </aside>
        <div className="pgate__card">{children}</div>
      </div>
    </div>
  )
}

function Auth({ mode: initial }) {
  const nav = useNavigate()
  const loc = useLocation()
  const [mode, setMode] = useState(initial) // login | signup | reset | sent | created
  const [f, setF] = useState({ email: '', password: '', full_name: '', business_name: '', phone: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const set = (k, v) => setF(o => ({ ...o, [k]: v }))
  useEffect(() => setMode(initial), [initial])
  useEffect(() => { api.loadMe().then(me => me && nav(homeFor(me), { replace: true })).catch(() => {}) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const go = m => { setErr(null); setMode(m); if (m === 'login' || m === 'signup') nav(m === 'login' ? '/entrar' : '/registro', { replace: true }) }
  const submit = async e => {
    e.preventDefault()
    setErr(null)
    if (mode === 'signup') {
      if (f.full_name.trim().length < 2) return setErr('Escribe tu nombre.')
      if (f.business_name.trim().length < 2) return setErr('Escribe el nombre de tu negocio.')
      if (f.phone.replace(/\D/g, '').length < 9) return setErr('Escribe tu WhatsApp con código de país.')
      if (f.password.length < 8) return setErr('La contraseña debe tener al menos 8 caracteres.')
    }
    setBusy(true)
    try {
      if (mode === 'login') { await api.signIn(f.email, f.password); nav(homeFor(await api.loadMe()), { replace: true }) }
      else if (mode === 'signup') { const r = await api.signUp(f); if (r.session) nav('/panel', { replace: true }); else setMode('created') }
      else { await api.sendReset(f.email); setMode('sent') }
    } catch (e2) { setErr(api.niceError(e2)) } finally { setBusy(false) }
  }

  if (mode === 'sent' || mode === 'created') return (
    <Shell>
      <span className="pgate__ic"><Mail size={26} /></span>
      <h1>Revisa tu correo</h1>
      <p>{mode === 'sent' ? `Si ${f.email} tiene una cuenta, te llegará un enlace para crear una contraseña nueva.` : `Te enviamos un enlace a ${f.email} para confirmar tu cuenta. Después, entra con tu correo y contraseña.`}</p>
      <button className="key key--lg key--block" onClick={() => go('login')}>Volver a entrar</button>
    </Shell>
  )

  const signup = mode === 'signup'
  return (
    <Shell>
      <div className="pauth__tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'login' || mode === 'reset'} onClick={() => go('login')}>Entrar</button>
        <button role="tab" aria-selected={signup} onClick={() => go('signup')}>Crear cuenta</button>
      </div>
      <h1>{mode === 'login' ? 'Bienvenido de vuelta' : signup ? 'Crea tu catálogo' : 'Recupera tu acceso'}</h1>
      <p>{mode === 'login' ? 'Entra a tu panel con tu correo y contraseña.' : signup ? 'Regístrate y activamos tu catálogo en breve.' : 'Te enviaremos un enlace para crear una contraseña nueva.'}</p>
      <form className="plogin" onSubmit={submit} noValidate>
        {signup && <>
          <label className="pf"><span className="pf__label">Tu nombre</span><input className="pin" autoComplete="name" value={f.full_name} onChange={e => set('full_name', e.target.value)} maxLength={80} /></label>
          <label className="pf"><span className="pf__label">Nombre de tu negocio</span><input className="pin" autoComplete="organization" value={f.business_name} onChange={e => set('business_name', e.target.value)} maxLength={60} /></label>
          <label className="pf"><span className="pf__label">WhatsApp (con código de país)</span><input className="pin" type="tel" inputMode="tel" autoComplete="tel" placeholder="51 999 888 777" value={f.phone} onChange={e => set('phone', e.target.value)} maxLength={20} /></label>
        </>}
        <label className="pf"><span className="pf__label">Correo</span><input className="pin" type="email" autoComplete="email" value={f.email} onChange={e => set('email', e.target.value)} autoFocus={!signup} /></label>
        {mode !== 'reset' && (
          <label className="pf"><span className="pf__label">Contraseña</span>
            <span className="pin-pass">
              <input className="pin" type={show ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} value={f.password} onChange={e => set('password', e.target.value)} />
              <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </span>
          </label>
        )}
        {err && <p className="pf__error" role="alert">{err}</p>}
        <button className="key key--accent key--lg key--block" disabled={busy || !f.email || (mode !== 'reset' && !f.password)}>
          {busy ? <Loader2 className="spin" size={18} /> : mode === 'login' ? <LogIn size={18} /> : signup ? <UserPlus size={18} /> : <Mail size={18} />}
          {mode === 'login' ? 'Entrar' : signup ? 'Crear cuenta' : 'Enviar enlace'}
        </button>
        {mode === 'login' && <button type="button" className="link-btn plogin__alt" onClick={() => go('reset')}>¿Olvidaste tu contraseña?</button>}
        {mode === 'reset' && <button type="button" className="link-btn plogin__alt" onClick={() => go('login')}>Volver a entrar</button>}
        {loc.state?.msg && <p className="pf__hint">{loc.state.msg}</p>}
      </form>
    </Shell>
  )
}

export function SetPassword() {
  const nav = useNavigate()
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [done, setDone] = useState(false)
  const submit = async e => {
    e.preventDefault()
    if (pass.length < 8) { setErr('Usa al menos 8 caracteres.'); return }
    setBusy(true); setErr(null)
    try { await api.setPassword(pass); setDone(true); setTimeout(async () => nav(homeFor(await api.loadMe()), { replace: true }), 1000) }
    catch (e2) { setErr(api.niceError(e2)) } finally { setBusy(false) }
  }
  return (
    <Shell>
      <h1>{done ? 'Contraseña guardada' : 'Crea tu contraseña'}</h1>
      <p>{done ? 'Entrando a tu panel…' : 'Usa al menos 8 caracteres.'}</p>
      {!done && (
        <form className="plogin" onSubmit={submit}>
          <label className="pf"><span className="pf__label">Contraseña nueva</span>
            <input className="pin" type="password" autoComplete="new-password" value={pass} onChange={e => setPass(e.target.value)} autoFocus />
          </label>
          {err && <p className="pf__error" role="alert">{err}</p>}
          <button className="key key--accent key--lg key--block" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : <Check size={18} />} Guardar</button>
        </form>
      )}
    </Shell>
  )
}
