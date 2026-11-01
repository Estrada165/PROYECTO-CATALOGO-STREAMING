import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Check, Loader2, Bot, Sparkles } from 'lucide-react'
import { usePanel, PageHead } from '../PanelApp'
import { Text, Area, Toggle, Confirm, Empty, ListEditor, SaveBar, Choice, ImageInput, Banner, Explain } from '../ui'
import Sheet from '../../components/Sheet'
import * as api from '../api'
import { getSupabase } from '../../lib/supabase'

const TONES = [
  { value: 'cercano', label: 'Cercano', hint: 'Amable, con emojis' },
  { value: 'formal', label: 'Formal', hint: 'Sobrio y claro' },
  { value: 'juvenil', label: 'Juvenil', hint: 'Relajado' },
]

export default function Lu() {
  const { data, tid, patch, toast, canEdit } = usePanel()
  const base = useMemo(() => ({ name: data.bot?.name || 'Lu', tone: data.bot?.tone || 'cercano', greeting: data.bot?.greeting || '', avatar_url: data.bot?.avatar_url || null, enabled: data.bot?.enabled ?? true }), [data.bot])
  const [f, setF] = useState(base)
  const [saving, setSaving] = useState(false)
  useEffect(() => setF(base), [base])
  const dirty = JSON.stringify(f) !== JSON.stringify(base)
  const set = (k, v) => setF(o => ({ ...o, [k]: v }))
  const save = async () => {
    if (!f.name.trim()) { toast('Ponle un nombre', 'warn'); return }
    setSaving(true)
    try { const b = await api.saveBot(tid, { ...f, name: f.name.trim(), greeting: f.greeting.trim() || null }); patch('bot', b); toast('Asistente guardado') }
    catch (e) { toast(api.niceError(e), 'error') } finally { setSaving(false) }
  }
  // El consumo se cuenta con la fecha de Lima (igual que el servidor) y se actualiza al abrir esta sección
  const [usage, setUsage] = useState(data.usage)
  useEffect(() => {
    let on = true
    const load = async () => {
      const sb = await getSupabase()
      const { data: rows } = await sb.from('ai_usage').select('day, count').eq('tenant_id', tid).order('day', { ascending: false }).limit(31)
      if (on && rows) { setUsage(rows); patch('usage', rows) }
    }
    load(); const t = setInterval(load, 30000)
    return () => { on = false; clearInterval(t) }
  }, [tid]) // eslint-disable-line react-hooks/exhaustive-deps
  const limaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())
  const today = usage.find(u => u.day === limaDay)?.count || 0
  const month = usage.filter(u => u.day.slice(0, 7) === limaDay.slice(0, 7)).reduce((a, u) => a + u.count, 0)

  return (
    <>
      <PageHead title="Asistente" text={`${f.name || 'Lu'} responde a tus clientes en el catálogo con tus precios, combos y preguntas frecuentes.`} />
      <Explain steps={[['Dale personalidad', 'Nombre, tono y saludo. Así se presenta en tu catálogo.'], ['Enséñale lo especial', 'Tus precios, combos y preguntas frecuentes ya los conoce. Agrega aquí los casos raros.'], ['Tus clientes le escriben', 'Aparece como un botón de chat en el catálogo y les arma el pedido para WhatsApp.']]} />
      <Banner tone="info" icon={<Sparkles size={18} />}>
        <b>Cómo se activa:</b> el administrador conecta la IA a tu catálogo (tú no necesitas ninguna clave). Cuando esté conectada, tus clientes verán el botón “Pregúntale a {f.name || 'Lu'}” abajo a la derecha. Lo que configures aquí lo usa desde el primer mensaje.
      </Banner>
      <fieldset className="pform" disabled={!canEdit}>
        <section className="pcard">
          <h2 className="pcard__title">Personalidad</h2>
          <div className="pfields">
            <Text label="Nombre" value={f.name} onChange={v => set('name', v)} max={24} />
            <ImageInput label="Foto o ícono (opcional)" value={f.avatar_url} onChange={v => set('avatar_url', v)} tid={tid} kind="bot" max={256} shape="round" canEdit={canEdit} />
            <Choice label="Tono" value={f.tone} onChange={v => set('tone', v)} options={TONES} />
            <Area label="Saludo" value={f.greeting} onChange={v => set('greeting', v)} max={160} rows={2} placeholder={`¡Hola! Soy ${f.name || 'Lu'}, ¿en qué te ayudo?`} />
            <Toggle label="Activado en el catálogo" checked={f.enabled} onChange={v => set('enabled', v)} />
          </div>
        </section>
        <section className="pcard">
          <h2 className="pcard__title">Consumo</h2>
          <div className="pstats pstats--plain">
            <div><b className="tnum">{today}</b><small>respuestas hoy</small></div>
            <div><b className="tnum">{month}</b><small>este mes</small></div>
          </div>
        </section>
        <BotFaqs />
      </fieldset>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => setF(base)} canEdit={canEdit} />
    </>
  )
}

function BotFaqs() {
  const { data, patch, toast, canEdit, tid } = usePanel()
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [saving, setSaving] = useState(false)
  const name = data.bot?.name || 'Lu'
  // Imágenes ya subidas (avisos y secciones de plataformas) para reutilizar con un toque
  const reuse = useMemo(() => {
    const out = []
    for (const a of data.anns) if (a.image_url) out.push({ url: a.image_url, label: `Aviso: ${a.title}` })
    for (const p of data.platforms) for (const x of p.extra_sections || []) if (x.kind === 'image' && x.image_url) out.push({ url: x.image_url, label: `${p.name}: ${x.title || 'imagen'}` })
    return out.filter((x, i) => out.findIndex(y => y.url === x.url) === i).slice(0, 12)
  }, [data.anns, data.platforms])
  const save = async () => {
    if (!edit.question?.trim() || !edit.answer?.trim()) { toast('Completa la pregunta y la respuesta', 'warn'); return }
    setSaving(true)
    try {
      const saved = await api.saveRow('bot_faqs', tid, { ...edit, question: edit.question.trim(), answer: edit.answer.trim() })
      patch('botFaqs', xs => edit.id ? xs.map(x => x.id === edit.id ? saved : x) : [...xs, saved])
      toast('Respuesta guardada'); setEdit(null)
    } catch (e) { toast(api.niceError(e), 'error') } finally { setSaving(false) }
  }
  return (
    <section className="pcard">
      <div className="pcard__head"><h2>Respuestas que {name} debe saber</h2>
        <button className="key key--sm" disabled={!canEdit} onClick={() => setEdit({ question: '', answer: '', keywords: [], image_url: null, active: true })}><Plus size={15} /> Agregar</button>
      </div>
      <p className="pmuted" style={{ marginBottom: 10 }}>Además de tus preguntas frecuentes y tu catálogo. Útil para casos especiales: “¿funciona en TV Box?”, “¿hacen factura?”.</p>
      {data.botFaqs.length === 0 ? <Empty icon={<Bot size={22} />} title="Sin respuestas propias" text={`${name} ya conoce tus precios, combos y preguntas frecuentes.`} /> : (
        <ul className="prows prows--flat">
          {data.botFaqs.map(f => (
            <li key={f.id} className={`prow${f.active ? '' : ' is-off'}`}>
              {f.image_url && <img className="prow__logo prow__logo--wide" src={f.image_url} alt="" />}
              <button className="prow__main" onClick={() => setEdit({ ...f })}><b>{f.question}</b><small>{f.answer}</small></button>
              <button className="key key--icon key--sm" onClick={() => setEdit({ ...f })} aria-label="Editar respuesta"><Pencil size={15} /></button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar respuesta' : 'Nueva respuesta'}
        footer={<div className="peditor__foot">
          {edit?.id && <button className="key key--icon" onClick={() => setDel(edit)} disabled={!canEdit} aria-label="Eliminar"><Trash2 size={17} /></button>}
          <button className="key key--accent key--lg" style={{ flex: 1 }} onClick={save} disabled={saving || !canEdit}>{saving ? <Loader2 className="spin" size={17} /> : <Check size={17} />} Guardar</button>
        </div>}>
        {edit && <fieldset className="pform" disabled={!canEdit}><div className="pfields">
          <Text label="Cuando pregunten…" value={edit.question} onChange={v => setEdit(e => ({ ...e, question: v }))} max={140} wide />
          <Area label={`${name} responde…`} value={edit.answer} onChange={v => setEdit(e => ({ ...e, answer: v }))} max={600} rows={4} />
          <ListEditor label="Palabras clave" hint="Otras formas de preguntar lo mismo. Ejemplo: cine, combos de cine, entradas." items={edit.keywords || []} onChange={v => setEdit(e => ({ ...e, keywords: v }))} chips />
          <ImageInput label="Imagen (opcional)" hint={`${name} la muestra junto a esta respuesta. Ideal para combos, tablas de precios o promociones.`} value={edit.image_url} onChange={v => setEdit(e => ({ ...e, image_url: v }))} tid={tid} kind="lu" max={1400} canEdit={canEdit} />
          {reuse.length > 0 && (
            <div className="pf pf--wide">
              <span className="pf__label">O usa una imagen que ya tienes</span>
              <div className="preuse">{reuse.map(x => (
                <button type="button" key={x.url} className={edit.image_url === x.url ? 'is-on' : ''} onClick={() => setEdit(e => ({ ...e, image_url: x.url }))} title={x.label}>
                  <img src={x.url} alt="" loading="lazy" /><span>{x.label}</span>
                </button>
              ))}</div>
            </div>
          )}
          <Toggle label="Activa" checked={edit.active} onChange={v => setEdit(e => ({ ...e, active: v }))} />
        </div></fieldset>}
      </Sheet>
      <Confirm open={!!del} title="¿Eliminar esta respuesta?" text={del?.question} onClose={() => setDel(null)} onConfirm={async () => {
        try { await api.deleteRow('bot_faqs', del.id); patch('botFaqs', xs => xs.filter(x => x.id !== del.id)); setDel(null); setEdit(null); toast('Respuesta eliminada') } catch (e) { toast(api.niceError(e), 'error') }
      }} />
    </section>
  )
}
