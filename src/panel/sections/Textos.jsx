import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, Check, Loader2, RotateCcw } from 'lucide-react'
import { usePanel, PageHead } from '../PanelApp'
import { Text, Area, Toggle, Confirm, OrderButtons, moveItem, Empty, ListEditor, SaveBar, Field } from '../ui'
import Sheet from '../../components/Sheet'
import { buildOrderMessage, DEFAULT_TEMPLATE } from '../../lib/cart'
import { HELP_KEYS, defaultHelp } from '../../lib/help'
import * as api from '../api'

const TABS = [['faq', 'Preguntas frecuentes'], ['terms', 'Garantía y condiciones'], ['how', 'Cómo comprar'], ['help', 'Ayudas (i)'], ['wa', 'Mensaje de WhatsApp']]

export default function Textos() {
  const [tab, setTab] = useState('faq')
  return (
    <>
      <PageHead title="Textos y ayuda" text="Todo lo que lee tu cliente: preguntas, condiciones, pasos, ayudas y el mensaje del pedido." />
      <div className="ptabs ptabs--page" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'faq' && <Faqs />}
      {tab === 'terms' && <SettingsText field="terms" render={(v, set) => <Terms value={v} onChange={set} />} />}
      {tab === 'how' && <SettingsText field={['how_to_buy', 'show_how_to_buy']} render={(v, set) => <HowTo value={v} onChange={set} />} />}
      {tab === 'help' && <SettingsText field="help_texts" render={(v, set) => <Help value={v} onChange={set} />} />}
      {tab === 'wa' && <SettingsText field="wa_order_template" render={(v, set) => <WaTemplate value={v} onChange={set} />} />}
    </>
  )
}

// Edita uno o varios campos de tenant_settings con barra de guardado
function SettingsText({ field, render }) {
  const { data, tid, patch, toast, canEdit } = usePanel()
  const fields = Array.isArray(field) ? field : [field]
  const base = useMemo(() => Object.fromEntries(fields.map(k => [k, data.settings[k]])), [data.settings]) // eslint-disable-line react-hooks/exhaustive-deps
  const [v, setV] = useState(base)
  const [saving, setSaving] = useState(false)
  useEffect(() => setV(base), [base])
  const dirty = JSON.stringify(v) !== JSON.stringify(base)
  const save = async () => {
    setSaving(true)
    try { const s = await api.saveSettings(tid, v); patch('settings', s); toast('Cambios guardados') }
    catch (e) { toast(api.niceError(e), 'error') } finally { setSaving(false) }
  }
  const value = Array.isArray(field) ? v : v[field]
  const set = nv => setV(Array.isArray(field) ? nv : { [field]: nv })
  return (
    <fieldset className="pform" disabled={!canEdit}>
      {render(value, set)}
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => setV(base)} canEdit={canEdit} />
    </fieldset>
  )
}

function Faqs() {
  const { data, patch, toast, canEdit, tid } = usePanel()
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const list = data.faqs
  const move = async (i, d) => {
    const next = moveItem(list, i, d); patch('faqs', next); setBusy(true)
    try { await api.reorder('faqs', next.map(x => x.id)) } catch (e) { toast(api.niceError(e), 'error') } finally { setBusy(false) }
  }
  const save = async () => {
    if (!edit.question?.trim() || !edit.answer?.trim()) { toast('Completa la pregunta y la respuesta', 'warn'); return }
    setSaving(true)
    try {
      const saved = await api.saveRow('faqs', tid, { ...edit, question: edit.question.trim(), answer: edit.answer.trim() })
      patch('faqs', xs => edit.id ? xs.map(x => x.id === edit.id ? saved : x) : [...xs, saved])
      toast('Pregunta guardada'); setEdit(null)
    } catch (e) { toast(api.niceError(e), 'error') } finally { setSaving(false) }
  }
  return (
    <section className="pcard">
      <div className="pcard__head"><h2>Preguntas frecuentes</h2>
        <button className="key key--sm" disabled={!canEdit} onClick={() => setEdit({ question: '', answer: '', active: true, sort: (list.length + 1) * 10 })}><Plus size={15} /> Agregar</button>
      </div>
      {list.length === 0 ? <Empty title="Sin preguntas" text="Responde lo que más te preguntan: entrega, garantía, cómo pagar." /> : (
        <ul className="prows prows--flat">
          {list.map((f, i) => (
            <li key={f.id} className={`prow${f.active ? '' : ' is-off'}`}>
              <OrderButtons index={i} total={list.length} onMove={move} disabled={!canEdit || busy} />
              <button className="prow__main" onClick={() => setEdit({ ...f })}><b>{f.question}</b><small>{f.answer}</small></button>
              <button className="key key--icon key--sm" onClick={() => setEdit({ ...f })} aria-label="Editar pregunta"><Pencil size={15} /></button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar pregunta' : 'Nueva pregunta'}
        footer={<div className="peditor__foot">
          {edit?.id && <button className="key key--icon" onClick={() => setDel(edit)} disabled={!canEdit} aria-label="Eliminar"><Trash2 size={17} /></button>}
          <button className="key key--accent key--lg" style={{ flex: 1 }} onClick={save} disabled={saving || !canEdit}>{saving ? <Loader2 className="spin" size={17} /> : <Check size={17} />} Guardar</button>
        </div>}>
        {edit && <fieldset className="pform" disabled={!canEdit}><div className="pfields">
          <Text label="Pregunta" value={edit.question} onChange={v => setEdit(e => ({ ...e, question: v }))} max={140} wide />
          <Area label="Respuesta" value={edit.answer} onChange={v => setEdit(e => ({ ...e, answer: v }))} max={600} rows={5} />
          <Toggle label="Visible" checked={edit.active} onChange={v => setEdit(e => ({ ...e, active: v }))} />
        </div></fieldset>}
      </Sheet>
      <Confirm open={!!del} title="¿Eliminar esta pregunta?" text={del?.question} onClose={() => setDel(null)} onConfirm={async () => {
        try { await api.deleteRow('faqs', del.id); patch('faqs', xs => xs.filter(x => x.id !== del.id)); setDel(null); setEdit(null); toast('Pregunta eliminada') } catch (e) { toast(api.niceError(e), 'error') }
      }} />
    </section>
  )
}

function Terms({ value = [], onChange }) {
  const upd = (i, k, v) => onChange(value.map((t, j) => j === i ? { ...t, [k]: v } : t))
  return (
    <section className="pcard">
      <p className="pmuted" style={{ marginBottom: 14 }}>Se abren desde “Garantía y condiciones”, en preguntas frecuentes y en la tarjeta de garantía.</p>
      <div className="pfields">
        {value.map((t, i) => (
          <div key={i} className="pblock pf--wide">
            <div className="pblock__head">
              <OrderButtons index={i} total={value.length} onMove={(k, d) => onChange(moveItem(value, k, d))} />
              <b>Bloque {i + 1}</b>
              <button className="key key--icon key--sm key--ghost" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Quitar bloque"><Trash2 size={15} /></button>
            </div>
            <div className="pfields">
              <Text label="Título" value={t.title} onChange={v => upd(i, 'title', v)} max={60} wide />
              <ListEditor label="Puntos" items={t.items || []} onChange={v => upd(i, 'items', v)} />
            </div>
          </div>
        ))}
        <button className="key pf--wide" onClick={() => onChange([...value, { title: '', items: [] }])}><Plus size={16} /> Agregar bloque</button>
      </div>
    </section>
  )
}

function HowTo({ value, onChange }) {
  const steps = value.how_to_buy || []
  const upd = (i, k, v) => onChange({ ...value, how_to_buy: steps.map((s, j) => j === i ? { ...s, [k]: v } : s) })
  return (
    <section className="pcard">
      <Toggle label="Mostrar “Así compras” en el inicio" hint="Una fila corta con los pasos y una burbuja (i) con el detalle." checked={value.show_how_to_buy} onChange={v => onChange({ ...value, show_how_to_buy: v })} />
      <div className="pfields" style={{ marginTop: 14 }}>
        {steps.map((s, i) => (
          <div key={i} className="pblock pf--wide">
            <div className="pblock__head">
              <OrderButtons index={i} total={steps.length} onMove={(k, d) => onChange({ ...value, how_to_buy: moveItem(steps, k, d) })} />
              <b>Paso {i + 1}</b>
              <button className="key key--icon key--sm key--ghost" onClick={() => onChange({ ...value, how_to_buy: steps.filter((_, j) => j !== i) })} aria-label="Quitar paso"><Trash2 size={15} /></button>
            </div>
            <div className="pfields">
              <Text label="Título corto" hint="Se ve en la fila: 2 o 3 palabras." value={s.title} onChange={v => upd(i, 'title', v)} max={24} />
              <Text label="Detalle" hint="Se ve al tocar (i)." value={s.text} onChange={v => upd(i, 'text', v)} max={120} />
            </div>
          </div>
        ))}
        {steps.length < 4 && <button className="key pf--wide" onClick={() => onChange({ ...value, how_to_buy: [...steps, { title: '', text: '' }] })}><Plus size={16} /> Agregar paso</button>}
      </div>
    </section>
  )
}

function Help({ value = {}, onChange }) {
  const { data, sym } = usePanel()
  const defs = defaultHelp(data.settings, data.rules, sym)
  return (
    <section className="pcard">
      <p className="pmuted" style={{ marginBottom: 14 }}>Son las burbujas que salen al tocar el ícono (i) en tu catálogo. Si dejas uno vacío, se usa el texto sugerido.</p>
      <div className="pfields">
        {HELP_KEYS.map(h => (
          <Field key={h.key} label={h.label} hint={h.where} wide>
            <div className="phelp">
              <textarea className="pin pin--area" rows={2} maxLength={260} placeholder={defs[h.key]} value={value[h.key] || ''}
                onChange={e => onChange({ ...value, [h.key]: e.target.value })} aria-label={`Ayuda: ${h.label}`} />
              {value[h.key] && <button type="button" className="key key--icon key--sm key--ghost" onClick={() => { const n = { ...value }; delete n[h.key]; onChange(n) }} aria-label="Volver al texto sugerido" title="Volver al texto sugerido"><RotateCcw size={15} /></button>}
            </div>
          </Field>
        ))}
      </div>
    </section>
  )
}

const VARS = [['{saludo}', 'buenos días / tardes / noches'], ['{nombre}', 'nombre del cliente'], ['{items}', 'lista de productos'], ['{subtotal}', 'subtotal'], ['{descuento}', 'línea de descuento (si hay)'], ['{total}', 'total'], ['{metodo}', 'método de pago']]
function WaTemplate({ value, onChange }) {
  const { data } = usePanel()
  const area = useRef(null)
  const tpl = value || DEFAULT_TEMPLATE
  const sample = useMemo(() => {
    const ps = data.platforms.filter(p => p.active && p.prices.length).slice(0, 2)
    const opt = data.options[0]
    const rows = ps.map(p => { const r = p.prices.find(x => x.option_id === opt?.id) || p.prices[0]; return { name: p.name, detail: opt ? `${opt.label} · ${opt.period}` : '', qty: 1, unit: Number(r.price) } })
    const subtotal = rows.reduce((a, r) => a + r.unit, 0)
    return { rows, subtotal, discount: 0, total: subtotal, count: rows.length }
  }, [data.platforms, data.options])
  const msg = buildOrderMessage({ summary: sample, settings: { ...data.settings, wa_order_template: tpl }, name: 'Ana', method: data.payments[0] })
  const insert = t => {
    const el = area.current; if (!el) return
    const s = el.selectionStart ?? tpl.length, e = el.selectionEnd ?? tpl.length
    onChange(tpl.slice(0, s) + t + tpl.slice(e))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + t.length, s + t.length) })
  }
  return (
    <div className="psplit psplit--even">
      <section className="pcard">
        <h2 className="pcard__title">Plantilla</h2>
        <p className="pmuted" style={{ marginBottom: 10 }}>Toca una variable para insertarla donde está el cursor. Usa *texto* para negritas en WhatsApp.</p>
        <div className="pquick">{VARS.map(([k, l]) => <button key={k} type="button" className="pchip pchip--btn" title={l} onClick={() => insert(k)}>{k}</button>)}</div>
        <textarea ref={area} className="pin pin--area pin--mono" rows={12} value={tpl} onChange={e => onChange(e.target.value)} aria-label="Plantilla del mensaje" />
        {value && <button className="key key--sm key--ghost" onClick={() => onChange(null)}><RotateCcw size={14} /> Usar la plantilla sugerida</button>}
      </section>
      <section className="pcard">
        <h2 className="pcard__title">Así llega (ejemplo)</h2>
        <div className="preview pwa">{msg}</div>
      </section>
    </div>
  )
}
