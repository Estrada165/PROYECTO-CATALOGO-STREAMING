import { useEffect, useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import { usePanel, PageHead } from '../PanelApp'
import { Text, Area, Select, Toggle, Choice, ImageInput, SaveBar, Field } from '../ui'
import Preview from '../Preview'
import Sheet from '../../components/Sheet'
import { FONTS } from '../../lib/fonts'
import { derivePalette } from '../../lib/color'
import * as api from '../api'

const PRESETS = ['#FF6B35', '#E50914', '#F43F5E', '#D946EF', '#8B5CF6', '#4F46E5', '#2563EB', '#0EA5E9', '#14B8A6', '#16A34A', '#84CC16', '#EAB308', '#F59E0B', '#111827']
const FIELDS = ['business_name', 'tagline', 'description', 'logo_url', 'logo_shape', 'favicon_url', 'accent', 'theme_default', 'card_style', 'radius',
  'font_display', 'font_body', 'font_cards', 'whatsapp', 'whatsapp_display', 'support_hours', 'location', 'currency_symbol', 'delivery_time', 'warranty_days']
const FONT_ROLES = [['font_display', 'Títulos', 'Nombre del negocio y títulos de sección'], ['font_cards', 'Tarjetas', 'Nombres y precios de las plataformas'], ['font_body', 'Texto', 'Descripciones, botones y textos largos']]
const pick = s => Object.fromEntries(FIELDS.map(k => [k, s[k] ?? null]))

// "+51 904 670 421" a partir de "51904670421"
export function formatPhone(d) {
  const x = String(d || '').replace(/\D/g, '')
  if (x.startsWith('51') && x.length === 11) return `+51 ${x.slice(2, 5)} ${x.slice(5, 8)} ${x.slice(8)}`
  return x ? `+${x}` : ''
}

export default function Marca() {
  const { data, tid, tenant, patch, toast, canEdit } = usePanel()
  const base = useMemo(() => pick(data.settings), [data.settings])
  const [f, setF] = useState(base)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [prev, setPrev] = useState(false)
  const [fontRole, setFontRole] = useState('font_display')
  useEffect(() => setF(base), [base])
  useEffect(() => { Object.values(FONTS).forEach(x => x.load().catch(() => {})) }, [])
  const set = (k, v) => setF(o => ({ ...o, [k]: v }))
  const dirty = JSON.stringify(f) !== JSON.stringify(base)
  const pal = useMemo(() => derivePalette(f.accent || '#FF6B35'), [f.accent])

  const validate = () => {
    const e = {}
    if (!f.business_name?.trim() || f.business_name.trim().length < 2) e.business_name = 'Escribe el nombre de tu negocio.'
    if (f.whatsapp && !/^[0-9]{8,15}$/.test(f.whatsapp)) e.whatsapp = 'Solo números, con código de país. Ejemplo: 51904670421'
    if (!/^#[0-9A-Fa-f]{6}$/.test(f.accent || '')) e.accent = 'Usa un color en formato #RRGGBB.'
    if (f.warranty_days !== null && f.warranty_days !== '' && (Number(f.warranty_days) < 0 || Number(f.warranty_days) > 365)) e.warranty_days = 'Entre 0 y 365 días.'
    setErrors(e)
    return !Object.keys(e).length
  }
  const save = async () => {
    if (!validate()) { toast('Revisa los campos marcados', 'warn'); return }
    setSaving(true)
    try {
      const out = { ...f, business_name: f.business_name.trim(), warranty_days: f.warranty_days === '' || f.warranty_days == null ? null : Number(f.warranty_days), radius: Number(f.radius) }
      const saved = await api.saveSettings(tid, out)
      patch('settings', saved); toast('Cambios guardados')
    } catch (e) { toast(api.niceError(e), 'error') } finally { setSaving(false) }
  }

  const fontOptions = Object.entries(FONTS).map(([k, x]) => ({ value: k, label: x.name, hint: x.style, preview: <span className="pfont" style={{ fontFamily: x.family }}>Aa</span> }))
  const draft = useMemo(() => ({ ...f, radius: Number(f.radius), warranty_days: f.warranty_days === '' ? null : Number(f.warranty_days) }), [f])

  const form = (
    <fieldset disabled={!canEdit} className="pform">
      <section className="pcard">
        <h2 className="pcard__title">Identidad</h2>
        <div className="pfields">
          <Text label="Nombre del negocio" value={f.business_name} onChange={v => set('business_name', v)} max={60} error={errors.business_name} />
          <Text label="Eslogan" hint="Una frase corta bajo el nombre." value={f.tagline} onChange={v => set('tagline', v)} max={80} />
          <Area label="Descripción" hint="Aparece en el pie de página y ayuda a tu asistente a presentarte." value={f.description} onChange={v => set('description', v)} max={280} />
          <ImageInput label="Logo" hint="Cuadrado, de 512 × 512 px o más." value={f.logo_url} onChange={v => set('logo_url', v)} tid={tid} kind="logo" shape={f.logo_shape === 'round' ? 'round' : 'square'} canEdit={canEdit} />
          <Choice label="Forma del logo" value={f.logo_shape} onChange={v => set('logo_shape', v)} cols={2} options={[
            { value: 'squircle', label: 'Redondeado', preview: <span className="pshape" /> },
            { value: 'round', label: 'Círculo', preview: <span className="pshape is-round" /> },
          ]} />
        </div>
      </section>

      <section className="pcard">
        <h2 className="pcard__title">Color y estilo</h2>
        <Field label="Color principal" hint="Con un solo color se arma toda la paleta. El texto siempre queda legible." error={errors.accent} wide>
          <div className="pcolors">
            {PRESETS.map(c => (
              <button key={c} type="button" className="pcolor" style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={f.accent?.toUpperCase() === c} onClick={() => set('accent', c)} />
            ))}
            <label className="pcolor pcolor--custom" aria-label="Elegir otro color">
              <input type="color" value={/^#[0-9A-Fa-f]{6}$/.test(f.accent || '') ? f.accent : '#FF6B35'} onChange={e => set('accent', e.target.value.toUpperCase())} />
            </label>
            <input className="pin pin--hex tnum" value={f.accent || ''} onChange={e => set('accent', e.target.value.toUpperCase().slice(0, 7))} aria-label="Código del color" />
          </div>
          <div className="pswatch">
            <span className="pswatch__btn" style={{ background: pal.accent, color: pal.onAccent, boxShadow: `0 3px 0 ${pal.accentEdge}` }}>Agregar</span>
            <span style={{ color: pal.accentTextLight }} className="pswatch__price">S/ 12.00</span>
            <span style={{ color: pal.accentTextDark, background: '#16181d' }} className="pswatch__price is-dark">S/ 12.00</span>
            {pal.adjusted && <small className="pmuted">Ajustamos un poco el tono del botón para que el texto se lea bien.</small>}
          </div>
        </Field>
        <Choice label="Estilo de tarjetas" value={f.card_style} onChange={v => set('card_style', v)} options={[
          { value: 'tecla', label: 'Tecla', hint: 'Con relieve', preview: <span className="pcardprev is-tecla" /> },
          { value: 'suave', label: 'Suave', hint: 'Sombra difusa', preview: <span className="pcardprev is-suave" /> },
          { value: 'linea', label: 'Línea', hint: 'Plana, con borde', preview: <span className="pcardprev is-linea" /> },
        ]} />
        <div className="pfields">
          <Field label={`Redondeo de esquinas: ${f.radius}px`}>
            <input type="range" min="8" max="28" step="1" value={f.radius} onChange={e => set('radius', Number(e.target.value))} className="prange" />
          </Field>
          <Select label="Tema al abrir" value={f.theme_default} onChange={v => set('theme_default', v)} options={[
            { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }, { value: 'system', label: 'Según el celular del cliente' },
          ]} />
        </div>
      </section>

      <section className="pcard">
        <h2 className="pcard__title">Tipografías</h2>
        <div className="ptabs ptabs--page" role="tablist" aria-label="Dónde se usa la tipografía">
          {FONT_ROLES.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={fontRole === k} onClick={() => setFontRole(k)}>
              {l} <small className="pfont-cur" style={{ fontFamily: FONTS[f[k]]?.family }}>{FONTS[f[k]]?.name}</small>
            </button>
          ))}
        </div>
        <Choice label={FONT_ROLES.find(r => r[0] === fontRole)[2]} value={f[fontRole]} onChange={v => set(fontRole, v)} cols={4} options={fontOptions} />
      </section>

      <section className="pcard">
        <h2 className="pcard__title">Contacto y atención</h2>
        <div className="pfields">
          <Text label="WhatsApp (con código de país)" placeholder="51904670421" inputMode="numeric" value={f.whatsapp}
            onChange={v => { const d = v.replace(/\D/g, '').slice(0, 15); set('whatsapp', d || null); if (!f.whatsapp_display || f.whatsapp_display === formatPhone(f.whatsapp)) set('whatsapp_display', formatPhone(d) || null) }}
            error={errors.whatsapp} hint="Aquí llegan los pedidos." />
          <Text label="Cómo se muestra el número" value={f.whatsapp_display} onChange={v => set('whatsapp_display', v)} placeholder="+51 904 670 421" />
          <Text label="Horario de atención" value={f.support_hours} onChange={v => set('support_hours', v)} placeholder="24 horas, 7 días a la semana" />
          <Text label="Ubicación" value={f.location} onChange={v => set('location', v)} placeholder="Lima, Perú" />
          <Text label="Tiempo de entrega" value={f.delivery_time} onChange={v => set('delivery_time', v)} placeholder="5 a 15 minutos" />
          <Text label="Días de garantía" inputMode="numeric" value={f.warranty_days ?? ''} onChange={v => set('warranty_days', v.replace(/\D/g, '').slice(0, 3))} error={errors.warranty_days} hint="Déjalo vacío si no das garantía." />
          <Select label="Moneda" value={f.currency_symbol} onChange={v => set('currency_symbol', v)} options={[
            { value: 'S/', label: 'Soles (S/)' }, { value: '$', label: 'Dólares ($)' }, { value: 'USD', label: 'USD' }, { value: '€', label: 'Euros (€)' }, { value: 'Bs', label: 'Bolivianos (Bs)' }, { value: 'COP', label: 'Pesos colombianos (COP)' }, { value: 'MXN', label: 'Pesos mexicanos (MXN)' },
          ]} />
        </div>
      </section>
    </fieldset>
  )

  return (
    <>
      <PageHead title="Marca y contacto" text="Logo, colores, tipografías y datos de atención."
        actions={<button className="key ponly-mobile" onClick={() => setPrev(true)}><Eye size={17} /> Vista previa</button>} />
      <div className="psplit">
        <div>{form}</div>
        <aside className="psplit__side"><Preview slug={tenant.slug} settings={draft} /></aside>
      </div>
      <Sheet open={prev} onClose={() => setPrev(false)} title="Vista previa">
        <Preview slug={tenant.slug} settings={draft} height={560} />
      </Sheet>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => { setF(base); setErrors({}) }} canEdit={canEdit} />
    </>
  )
}
