import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, Loader2, Megaphone } from 'lucide-react'
import { usePanel, PageHead } from '../PanelApp'
import { Text, Area, Select, Toggle, ImageInput, Confirm, OrderButtons, moveItem, Empty, Choice, Field } from '../ui'
import Sheet from '../../components/Sheet'
import * as api from '../api'

const TONES = [
  { value: 'accent', label: 'Promoción', color: 'var(--accent)' },
  { value: 'info', label: 'Novedad', color: '#3b82f6' },
  { value: 'success', label: 'Buena noticia', color: '#1d9a50' },
  { value: 'warning', label: 'Importante', color: '#e0a20b' },
]
const CTA = [{ value: 'none', label: 'Sin botón' }, { value: 'platform', label: 'Abrir una plataforma' }, { value: 'whatsapp', label: 'Escribir por WhatsApp' }, { value: 'url', label: 'Ir a una sección o enlace' }]
const SECTIONS = [{ value: '#combos', label: 'Sección Combos' }, { value: '#catalogo-grid', label: 'Catálogo' }, { value: '#preguntas', label: 'Preguntas frecuentes' }]

// datetime-local ↔ ISO
const toLocal = iso => { if (!iso) return ''; const d = new Date(iso); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16) }
const fromLocal = v => (v ? new Date(v).toISOString() : null)
const fmt = iso => new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })

export function annStatus(a, now = Date.now()) {
  if (!a.is_active) return { k: 'off', label: 'Oculto' }
  if (new Date(a.starts_at) > now) return { k: 'soon', label: `Desde el ${fmt(a.starts_at)}` }
  if (a.ends_at && new Date(a.ends_at) <= now) return { k: 'past', label: 'Terminó' }
  return { k: 'on', label: a.ends_at ? `Hasta el ${fmt(a.ends_at)}` : 'Visible' }
}

export default function Avisos() {
  const { data, patch, toast, canEdit, tid } = usePanel()
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const list = data.anns
  const move = async (i, d) => {
    const next = moveItem(list, i, d); patch('anns', next); setBusy(true)
    try { await api.reorder('announcements', next.map(x => x.id)) } catch (e) { toast(api.niceError(e), 'error') } finally { setBusy(false) }
  }
  const set = (k, v) => setEdit(e => ({ ...e, [k]: v }))
  const save = async () => {
    const t = edit.title?.trim() || ''
    if (t.length < 2) { toast('Escribe un título', 'warn'); return }
    if (edit.ends_at && new Date(edit.ends_at) <= new Date(edit.starts_at)) { toast('La fecha de fin debe ser después del inicio', 'warn'); return }
    if (edit.cta_kind !== 'none' && !edit.cta_label?.trim()) { toast('Escribe el texto del botón', 'warn'); return }
    setSaving(true)
    try {
      const row = { ...edit, title: t, message: edit.message?.trim() || null, cta_label: edit.cta_kind === 'none' ? null : edit.cta_label.trim(), cta_value: edit.cta_kind === 'none' ? null : edit.cta_value || null }
      const saved = await api.saveRow('announcements', tid, row)
      patch('anns', xs => edit.id ? xs.map(x => x.id === edit.id ? saved : x) : [...xs, saved])
      toast('Aviso guardado'); setEdit(null)
    } catch (e) { toast(api.niceError(e), 'error') } finally { setSaving(false) }
  }

  return (
    <>
      <PageHead title="Avisos" text="Promociones y novedades. Salen en la barra superior del catálogo y, si quieres, como ventana al entrar (una vez por visita)."
        actions={<button className="key key--accent" disabled={!canEdit} onClick={() => setEdit({ title: '', message: '', image_url: null, tone: 'accent', cta_kind: 'none', cta_label: '', cta_value: '', starts_at: new Date().toISOString(), ends_at: null, show_popup: true, is_active: true, sort: 0 })}><Plus size={17} /> Nuevo aviso</button>} />
      {list.length === 0 ? <Empty icon={<Megaphone size={22} />} title="Sin avisos" text="Anuncia una promoción, un cambio de precio o un horario especial." /> : (
        <ul className="prows">
          {list.map((a, i) => {
            const st = annStatus(a)
            return (
              <li key={a.id} className={`prow${st.k === 'on' ? '' : ' is-off'}`}>
                <OrderButtons index={i} total={list.length} onMove={move} disabled={!canEdit || busy} />
                {a.image_url ? <img className="prow__logo prow__logo--wide" src={a.image_url} alt="" /> : <span className="prow__tone" style={{ background: TONES.find(t => t.value === a.tone)?.color }}><Megaphone size={17} /></span>}
                <button className="prow__main" onClick={() => setEdit({ ...a })}>
                  <b>{a.title}<span className={`ptag ptag--${st.k}`}>{st.label}</span>{a.show_popup && st.k === 'on' && <span className="ptag is-muted">Ventana</span>}</b>
                  <small>{a.message || 'Sin mensaje'}</small>
                </button>
                <button className="key key--icon key--sm" onClick={() => setEdit({ ...a })} aria-label={`Editar ${a.title}`}><Pencil size={15} /></button>
              </li>
            )
          })}
        </ul>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} variant="drawer" title={edit?.id ? 'Editar aviso' : 'Nuevo aviso'}
        footer={<div className="peditor__foot">
          {edit?.id && <button className="key key--icon" onClick={() => setDel(edit)} disabled={!canEdit} aria-label="Eliminar"><Trash2 size={17} /></button>}
          <button className="key key--accent key--lg" style={{ flex: 1 }} onClick={save} disabled={saving || !canEdit}>{saving ? <Loader2 className="spin" size={17} /> : <Check size={17} />} Guardar aviso</button>
        </div>}>
        {edit && <fieldset className="pform" disabled={!canEdit}><div className="pfields">
          <Text label="Título" value={edit.title} onChange={v => set('title', v)} max={90} wide />
          <Area label="Mensaje" value={edit.message} onChange={v => set('message', v)} max={300} />
          <ImageInput label="Imagen (opcional)" hint="Se muestra completa, sin recortes." value={edit.image_url} onChange={v => set('image_url', v)} tid={tid} kind="aviso" max={1400} canEdit={canEdit} />
          <Choice label="Tipo" value={edit.tone} onChange={v => set('tone', v)} cols={4} options={TONES.map(t => ({ value: t.value, label: t.label, preview: <span className="ptone" style={{ background: t.color }} /> }))} />
          <Select label="Botón" value={edit.cta_kind} onChange={v => set('cta_kind', v)} options={CTA} />
          {edit.cta_kind !== 'none' && <Text label="Texto del botón" value={edit.cta_label} onChange={v => set('cta_label', v)} max={30} placeholder="Ver combos" />}
          {edit.cta_kind === 'platform' && <Select label="Plataforma" value={edit.cta_value || ''} onChange={v => set('cta_value', v)} options={[{ value: '', label: 'Elige…' }, ...data.platforms.filter(p => p.active).map(p => ({ value: p.id, label: p.name }))]} wide />}
          {edit.cta_kind === 'whatsapp' && <Text label="Mensaje que se envía" value={edit.cta_value} onChange={v => set('cta_value', v)} placeholder="Hola, quiero la promo de…" wide />}
          {edit.cta_kind === 'url' && <Field label="Destino" wide>
            <div className="pquick">{SECTIONS.map(s => <button key={s.value} type="button" className={`pchip pchip--btn${edit.cta_value === s.value ? ' is-on' : ''}`} onClick={() => set('cta_value', s.value)}>{s.label}</button>)}</div>
            <input className="pin" value={edit.cta_value || ''} onChange={e => set('cta_value', e.target.value)} placeholder="o un enlace: https://…" aria-label="Enlace" />
          </Field>}
          <Text label="Desde" type="datetime-local" value={toLocal(edit.starts_at)} onChange={v => set('starts_at', fromLocal(v) || new Date().toISOString())} />
          <Text label="Hasta (opcional)" type="datetime-local" value={toLocal(edit.ends_at)} onChange={v => set('ends_at', fromLocal(v))} hint="Vacío = sin fecha de fin." />
          <Toggle label="Mostrar como ventana al entrar" hint="Una vez por visita, si el cliente no lo ha visto." checked={edit.show_popup} onChange={v => set('show_popup', v)} />
          <Toggle label="Activo" checked={edit.is_active} onChange={v => set('is_active', v)} />
        </div></fieldset>}
      </Sheet>
      <Confirm open={!!del} title="¿Eliminar este aviso?" text={`“${del?.title}” se borra para siempre.`}
        onClose={() => setDel(null)} onConfirm={async () => {
          try { await api.deleteRow('announcements', del.id); patch('anns', xs => xs.filter(x => x.id !== del.id)); setDel(null); setEdit(null); toast('Aviso eliminado') } catch (e) { toast(api.niceError(e), 'error') }
        }} />
    </>
  )
}
