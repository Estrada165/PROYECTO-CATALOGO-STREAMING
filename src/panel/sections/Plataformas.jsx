import { useMemo, useState } from 'react'
import { Plus, Search, Pencil, Table2, List, Sparkles, Library, Loader2, Check, EyeOff, Trash2, Copy } from 'lucide-react'
import { usePanel, PageHead } from '../PanelApp'
import { Dropdown, Text, Area, Select, Toggle, Choice, ListEditor, ImageInput, Money, Confirm, Empty, OrderButtons, moveItem, norm, Field } from '../ui'
import Sheet from '../../components/Sheet'
import { money } from '../../lib/format'
import * as api from '../api'

const BADGES = [{ value: '', label: 'Sin etiqueta' }, { value: 'popular', label: 'Popular' }, { value: 'nuevo', label: 'Nuevo' }, { value: 'oferta', label: 'Oferta' }, { value: 'limitado', label: 'Últimos' }]
const STOCK = [{ value: 'available', label: 'Disponible' }, { value: 'low', label: 'Pocas unidades' }, { value: 'out', label: 'Agotado' }]
const CAT_KEY = { streaming: ['streaming'], music: ['musica', 'music'], tools: ['herramientas', 'tools', 'ia'], iptv: ['iptv', 'tv en vivo', 'tv'], special: ['especiales', 'especial'] }

export default function Plataformas() {
  const { data, patch, toast, canEdit, tid, sym } = usePanel()
  const [view, setView] = useState('list')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [edit, setEdit] = useState(null)       // plataforma en edición (borrador)
  const [adding, setAdding] = useState(false)
  const [del, setDel] = useState(null)
  const [busyOrder, setBusyOrder] = useState(false)

  const catName = id => data.categories.find(c => c.id === id)?.name || 'Sin categoría'
  const list = data.platforms.filter(p => (cat === 'all' || p.category_id === cat) && (!q || norm(p.name + ' ' + (p.tags || []).join(' ')).includes(norm(q))))
  const filtered = cat !== 'all' || q

  const move = async (i, d) => {
    const next = moveItem(data.platforms, data.platforms.indexOf(list[i]), d)
    patch('platforms', next); setBusyOrder(true)
    try { await api.reorder('platforms', next.map(p => p.id)) } catch (e) { toast(api.niceError(e), 'error') } finally { setBusyOrder(false) }
  }
  const toggle = async p => {
    try { const saved = await api.saveRow('platforms', tid, { ...p, active: !p.active }); patch('platforms', ps => ps.map(x => x.id === p.id ? { ...x, ...saved } : x)); toast(saved.active ? `${p.name} visible` : `${p.name} oculta`) }
    catch (e) { toast(api.niceError(e), 'error') }
  }
  const startFromLibrary = lib => {
    const keys = CAT_KEY[lib.category_key] || []
    const c = data.categories.find(x => keys.includes(norm(x.name))) || data.categories[0]
    setAdding(false)
    setEdit(blank({ library_id: lib.id, name: lib.name, logo_url: lib.logo_url, description: lib.description, features: lib.features, restrictions: lib.restrictions, tags: lib.tags, popular_content: lib.popular_content, extra_sections: lib.extra_sections, category_id: c?.id || null }, data))
  }

  return (
    <>
      <PageHead title="Plataformas y precios" text="Agrega plataformas desde la biblioteca o crea las tuyas. El orden aquí es el orden del catálogo."
        actions={<button className="key key--accent" onClick={() => setAdding(true)} disabled={!canEdit}><Plus size={17} /> Agregar plataforma</button>} />

      <div className="ptools">
        <div className="psearch"><Search size={17} /><input className="pin" placeholder="Buscar plataforma" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar plataforma" /></div>
        <div className="ptools__drop"><Dropdown value={cat} onChange={setCat} label="Filtrar por categoría" options={[{ value: 'all', label: 'Todas las categorías' }, ...data.categories.map(c => ({ value: c.id, label: c.name }))]} /></div>
        <div className="pseg" role="group" aria-label="Vista">
          <button aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={15} /> Lista</button>
          <button aria-pressed={view === 'table'} onClick={() => setView('table')}><Table2 size={15} /> Tabla de precios</button>
        </div>
      </div>

      {view === 'table' ? <PriceTable list={list} /> : list.length === 0 ? (
        <Empty icon={<Library size={22} />} title={filtered ? 'No hay resultados' : 'Aún no tienes plataformas'} text={filtered ? 'Prueba con otra búsqueda o categoría.' : 'Empieza agregando una desde la biblioteca.'}
          action={!filtered && <button className="key key--accent" onClick={() => setAdding(true)}><Plus size={17} /> Agregar plataforma</button>} />
      ) : (
        <ul className="prows">
          {list.map((p, i) => (
            <li key={p.id} className={`prow${p.active ? '' : ' is-off'}`}>
              {!filtered && <OrderButtons index={i} total={list.length} onMove={move} disabled={!canEdit || busyOrder} />}
              <img className="prow__logo" src={p.logo_url || ''} alt="" width="44" height="44" />
              <button className="prow__main" onClick={() => setEdit(toDraft(p, data))}>
                <b>{p.name}{p.badge && <span className="ptag">{BADGES.find(b => b.value === p.badge)?.label}</span>}{!p.active && <span className="ptag is-muted"><EyeOff size={12} /> Oculta</span>}</b>
                <small>{catName(p.category_id)} · {priceSummary(p, data.options, sym)}</small>
              </button>
              <div className="prow__acts">
                <label className="ptoggle ptoggle--mini" title={p.active ? 'Visible en el catálogo' : 'Oculta'}>
                  <input type="checkbox" role="switch" checked={p.active} disabled={!canEdit} onChange={() => toggle(p)} aria-label={`${p.active ? 'Ocultar' : 'Mostrar'} ${p.name}`} />
                  <span className="ptoggle__ui" aria-hidden="true" />
                </label>
                <button className="key key--icon key--sm" onClick={() => setEdit(toDraft(p, data))} aria-label={`Editar ${p.name}`}><Pencil size={15} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddPlatform open={adding} onClose={() => setAdding(false)} onPick={startFromLibrary} onBlank={() => { setAdding(false); setEdit(blank({ category_id: data.categories[0]?.id || null }, data)) }} />
      <Editor draft={edit} setDraft={setEdit} onDelete={p => setDel(p)} />
      <Confirm open={!!del} title={`¿Eliminar ${del?.name}?`} text="Se borra del catálogo junto con sus precios y se quita de los combos donde esté. Si solo quieres ocultarla un tiempo, usa el interruptor."
        onClose={() => setDel(null)} onConfirm={async () => {
          try { await api.deleteRow('platforms', del.id); patch('platforms', ps => ps.filter(x => x.id !== del.id)); patch('combos', cs => cs.map(c => ({ ...c, platform_ids: c.platform_ids.filter(id => id !== del.id) }))); setDel(null); setEdit(null); toast('Plataforma eliminada') }
          catch (e) { toast(api.niceError(e), 'error') }
        }} />
    </>
  )
}

function priceSummary(p, options, sym) {
  if (p.pricing_mode === 'fixed') return p.fixed_price != null ? `${money(p.fixed_price, sym)} único` : 'Sin precio'
  if (p.pricing_mode === 'consult') return 'Precio a consultar'
  const vals = p.prices.map(r => Number(r.price))
  if (!vals.length) return 'Sin precios'
  const min = Math.min(...vals)
  return `desde ${money(min, sym)} · ${vals.length} de ${options.length} duraciones`
}

function blank(over, data) {
  return {
    id: null, library_id: null, name: '', logo_url: null, description: '', features: [], restrictions: [], tags: [], popular_content: [], extra_sections: [],
    badge: null, stock: 'available', pricing_mode: 'options', fixed_price: null, fixed_note: '', consult_note: '', active: true,
    sort: (Math.max(0, ...data.platforms.map(p => p.sort || 0)) + 10), category_id: null,
    priceRows: data.options.map(o => ({ option_id: o.id, price: '', note: '' })),
    ...over,
  }
}
function toDraft(p, data) {
  return {
    ...p, fixed_price: p.fixed_price ?? null, fixed_note: p.fixed_note || '', consult_note: p.consult_note || '',
    priceRows: data.options.map(o => { const r = p.prices.find(x => x.option_id === o.id); return { option_id: o.id, price: r ? String(r.price) : '', note: r?.note || '' } }),
  }
}

// Buscador de la biblioteca con autocompletado
function AddPlatform({ open, onClose, onPick, onBlank }) {
  const { data } = usePanel()
  const [q, setQ] = useState('')
  const have = new Set(data.platforms.map(p => p.library_id).filter(Boolean))
  const res = data.library.filter(l => !q || norm(`${l.name} ${l.tags.join(' ')}`).includes(norm(q)))
  return (
    <Sheet open={open} onClose={onClose} title="Agregar plataforma"
      footer={<button className="key key--block key--lg" onClick={onBlank}><Sparkles size={17} /> {q && !res.length ? `Crear “${q}” desde cero` : 'Crear una desde cero'}</button>}>
      <p className="pmuted" style={{ marginBottom: 12 }}>Elige de la biblioteca y se completan solos el logo, la descripción, las características y las restricciones. Después puedes editarlos.</p>
      <div className="psearch psearch--big"><Search size={18} /><input className="pin" autoFocus placeholder="Escribe: Netflix, Max, Spotify…" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar en la biblioteca" /></div>
      <ul className="plib">
        {res.map(l => (
          <li key={l.id}>
            <button onClick={() => onPick(l)}>
              <img src={l.logo_url} alt="" width="40" height="40" />
              <span><b>{l.name}</b><small>{l.features.length} características · {l.restrictions.length} restricciones</small></span>
              {have.has(l.id) ? <span className="ptag is-muted">Ya la tienes</span> : <Plus size={17} />}
            </button>
          </li>
        ))}
        {!res.length && <li className="pmuted plib__none">No está en la biblioteca. Créala desde cero con el botón de abajo.</li>}
      </ul>
    </Sheet>
  )
}

function Editor({ draft, setDraft, onDelete }) {
  const { data, tid, patch, toast, canEdit, sym } = usePanel()
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('general')
  const [err, setErr] = useState({})
  const open = !!draft
  const d = draft || {}
  const set = (k, v) => setDraft(o => ({ ...o, [k]: v }))

  // Sugerencias para el autocompletado: biblioteca + tus otras plataformas
  const sug = useMemo(() => {
    const all = [...data.library, ...data.platforms]
    const pickAll = k => all.flatMap(x => x[k] || [])
    return { features: pickAll('features'), restrictions: pickAll('restrictions'), tags: pickAll('tags'), popular_content: pickAll('popular_content') }
  }, [data.library, data.platforms])

  const save = async () => {
    const e = {}
    if (!d.name?.trim()) e.name = 'Escribe el nombre.'
    if (d.pricing_mode === 'fixed' && (d.fixed_price === '' || d.fixed_price == null)) e.fixed_price = 'Pon el precio único.'
    if (d.pricing_mode === 'options' && !d.priceRows.some(r => r.price !== '')) e.prices = 'Pon al menos un precio (o cambia a "Consultar").'
    setErr(e)
    if (Object.keys(e).length) { setTab(e.name ? 'general' : 'precios'); return }
    setSaving(true)
    try {
      const { priceRows, ...row } = d
      const out = { ...row, name: d.name.trim(), badge: d.badge || null, fixed_price: d.pricing_mode === 'fixed' ? Number(d.fixed_price) : null,
        fixed_note: d.fixed_note?.trim() || null, consult_note: d.consult_note?.trim() || null, description: d.description?.trim() || null }
      const rows = d.pricing_mode === 'options' ? priceRows : priceRows.map(r => ({ ...r, price: '' }))
      const saved = await api.savePlatform(tid, out, rows)
      const prices = rows.filter(r => r.price !== '').map(r => ({ platform_id: saved.id, option_id: r.option_id, price: Number(r.price), note: r.note || null }))
      const full = { ...saved, prices }
      patch('platforms', ps => d.id ? ps.map(x => x.id === d.id ? full : x) : [...ps, full])
      toast(d.id ? 'Plataforma guardada' : `${saved.name} agregada al catálogo`)
      setDraft(null); setTab('general')
    } catch (e2) { toast(api.niceError(e2), 'error') } finally { setSaving(false) }
  }
  const duplicate = () => setDraft(o => ({ ...o, id: null, name: `${o.name} (copia)`, library_id: null }))

  const TABS = [['general', 'General'], ['precios', 'Precios'], ['detalles', 'Detalles'], ['extra', 'Secciones']]
  return (
    <Sheet open={open} onClose={() => { setDraft(null); setTab('general'); setErr({}) }} variant="drawer" title={d.id ? `Editar ${d.name || 'plataforma'}` : 'Nueva plataforma'}
      footer={<div className="peditor__foot">
        {d.id && <button className="key key--icon" onClick={() => onDelete(d)} disabled={!canEdit} aria-label="Eliminar plataforma"><Trash2 size={17} /></button>}
        {d.id && <button className="key key--icon" onClick={duplicate} disabled={!canEdit} aria-label="Duplicar plataforma" title="Duplicar"><Copy size={17} /></button>}
        <button className="key key--accent key--lg" style={{ flex: 1 }} onClick={save} disabled={saving || !canEdit}>{saving ? <Loader2 className="spin" size={17} /> : <Check size={17} />} {d.id ? 'Guardar' : 'Agregar al catálogo'}</button>
      </div>}>
      {open && <>
        <div className="ptabs" role="tablist">
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}{k === 'precios' && err.prices && <span className="ptabs__dot" />}</button>)}
        </div>
        <fieldset disabled={!canEdit} className="pform">
          {tab === 'general' && <div className="pfields">
            <ImageInput label="Logo" value={d.logo_url} onChange={v => set('logo_url', v)} tid={tid} kind="platform" canEdit={canEdit} />
            <Text label="Nombre" value={d.name} onChange={v => set('name', v)} max={60} error={err.name} />
            <Select label="Categoría" value={d.category_id || ''} onChange={v => set('category_id', v || null)} options={[{ value: '', label: 'Sin categoría' }, ...data.categories.map(c => ({ value: c.id, label: c.name }))]} />
            <Select label="Etiqueta" value={d.badge || ''} onChange={v => set('badge', v || null)} options={BADGES} />
            <Select label="Disponibilidad" value={d.stock} onChange={v => set('stock', v)} options={STOCK} />
            <Area label="Descripción" value={d.description} onChange={v => set('description', v)} max={400} rows={4} />
            <Toggle label="Visible en el catálogo" checked={d.active} onChange={v => set('active', v)} />
          </div>}

          {tab === 'precios' && <div className="pfields">
            <Choice label="¿Cómo se cobra?" value={d.pricing_mode} onChange={v => set('pricing_mode', v)} options={[
              { value: 'options', label: 'Por duración', hint: '1 mes, 3 meses…' },
              { value: 'fixed', label: 'Precio único', hint: 'Un solo pago' },
              { value: 'consult', label: 'Consultar', hint: 'Abre WhatsApp' },
            ]} />
            {d.pricing_mode === 'options' && <Field label="Precio por duración" hint="Deja vacío donde no la vendes: no aparecerá en esa duración." error={err.prices} wide>
              <div className="pprices">
                {data.options.map((o, i) => (
                  <div key={o.id} className="pprices__row">
                    <span className="pprices__name"><b>{o.label}</b><small>{o.period}{!o.active && ' · oculta'}</small></span>
                    <div className="pin-money"><span>{sym}</span><input className="pin tnum" inputMode="decimal" placeholder="—" value={d.priceRows[i]?.price ?? ''} aria-label={`Precio ${o.label} ${o.period}`}
                      onChange={e => { const v = e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''); setDraft(x => ({ ...x, priceRows: x.priceRows.map((r, k) => k === i ? { ...r, price: v } : r) })) }} /></div>
                    <input className="pin pprices__note" placeholder="Nota (opcional)" value={d.priceRows[i]?.note ?? ''} aria-label={`Nota ${o.label} ${o.period}`}
                      onChange={e => setDraft(x => ({ ...x, priceRows: x.priceRows.map((r, k) => k === i ? { ...r, note: e.target.value } : r) }))} />
                  </div>
                ))}
              </div>
            </Field>}
            {d.pricing_mode === 'fixed' && <>
              <Money label="Precio único" sym={sym} value={d.fixed_price ?? ''} onChange={v => set('fixed_price', v)} />
              {err.fixed_price && <p className="pf__error">{err.fixed_price}</p>}
              <Text label="Nota del precio" value={d.fixed_note} onChange={v => set('fixed_note', v)} placeholder="Incluye activación por 18 meses" wide />
            </>}
            {d.pricing_mode === 'consult' && <Text label="Nota para el cliente" value={d.consult_note} onChange={v => set('consult_note', v)} placeholder="Precio según disponibilidad. Consúltanos por WhatsApp." wide />}
          </div>}

          {tab === 'detalles' && <div className="pfields">
            <ListEditor label="Características" hint="Lo que incluye. Al escribir te sugerimos textos de otras plataformas." items={d.features} onChange={v => set('features', v)} suggestions={sug.features} />
            <ListEditor label="Restricciones" hint="Lo que el cliente no debe hacer." items={d.restrictions} onChange={v => set('restrictions', v)} suggestions={sug.restrictions} />
            <ListEditor label="Contenido popular" hint="Series, ligas o artistas. Ayudan al buscador." items={d.popular_content} onChange={v => set('popular_content', v)} suggestions={sug.popular_content} chips />
            <ListEditor label="Palabras clave" hint="Para que la encuentren al buscar: anime, fútbol, música…" items={d.tags} onChange={v => set('tags', v)} suggestions={sug.tags} chips />
          </div>}

          {tab === 'extra' && <ExtraSections value={d.extra_sections || []} onChange={v => set('extra_sections', v)} />}
        </fieldset>
      </>}
    </Sheet>
  )
}

const KINDS = [{ value: 'steps', label: 'Pasos numerados' }, { value: 'list', label: 'Lista con checks' }, { value: 'note', label: 'Nota destacada' }, { value: 'image', label: 'Imagen' }]
function ExtraSections({ value, onChange }) {
  const { tid, canEdit } = usePanel()
  const upd = (i, k, v) => onChange(value.map((s, j) => j === i ? { ...s, [k]: v } : s))
  return (
    <div className="pfields">
      <p className="pmuted pf--wide">Bloques que aparecen en el detalle de la plataforma: cómo se activa, condiciones, una imagen con combos…</p>
      {value.map((s, i) => (
        <div key={i} className="pblock pf--wide">
          <div className="pblock__head">
            <OrderButtons index={i} total={value.length} onMove={(k, dd) => onChange(moveItem(value, k, dd))} />
            <b>Sección {i + 1}</b>
            <button className="key key--icon key--sm key--ghost" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Quitar sección"><Trash2 size={15} /></button>
          </div>
          <div className="pfields">
            <Text label="Título" value={s.title} onChange={v => upd(i, 'title', v)} max={60} />
            <Select label="Tipo" value={s.kind} onChange={v => upd(i, 'kind', v)} options={KINDS} />
            {s.kind === 'image'
              ? <ImageInput label="Imagen" value={s.image_url} onChange={v => upd(i, 'image_url', v)} tid={tid} kind="section" max={1400} canEdit={canEdit} />
              : <ListEditor label={s.kind === 'steps' ? 'Pasos' : s.kind === 'note' ? 'Párrafos' : 'Elementos'} items={s.items || []} onChange={v => upd(i, 'items', v)} />}
          </div>
        </div>
      ))}
      <button className="key pf--wide" onClick={() => onChange([...value, { title: 'Cómo se activa', kind: 'steps', items: [] }])}><Plus size={16} /> Agregar sección</button>
    </div>
  )
}

// Edición rápida de todos los precios en una tabla
function PriceTable({ list }) {
  const { data, tid, patch, toast, canEdit, sym } = usePanel()
  const rows = list.filter(p => p.pricing_mode === 'options')
  const [cells, setCells] = useState({})
  const [saving, setSaving] = useState(false)
  const key = (p, o) => `${p}|${o}`
  const cur = (p, o) => { const r = p.prices.find(x => x.option_id === o.id); return r ? String(Number(r.price)) : '' }
  const changed = Object.entries(cells).filter(([k, v]) => { const [pid, oid] = k.split('|'); const p = data.platforms.find(x => x.id === pid); return p && v !== cur(p, { id: oid }) })
  const save = async () => {
    setSaving(true)
    try {
      const list2 = changed.map(([k, v]) => { const [platform_id, option_id] = k.split('|'); return { platform_id, option_id, price: v === '' ? null : Number(v) } })
      await api.savePriceCells(tid, list2)
      patch('platforms', ps => ps.map(p => {
        const mine = list2.filter(x => x.platform_id === p.id)
        if (!mine.length) return p
        let prices = p.prices.filter(r => !mine.some(m => m.option_id === r.option_id))
        prices = [...prices, ...mine.filter(m => m.price != null).map(m => ({ platform_id: p.id, option_id: m.option_id, price: m.price, note: p.prices.find(r => r.option_id === m.option_id)?.note || null }))]
        return { ...p, prices }
      }))
      setCells({}); toast(`${list2.length} ${list2.length === 1 ? 'precio guardado' : 'precios guardados'}`)
    } catch (e) { toast(api.niceError(e), 'error') } finally { setSaving(false) }
  }
  if (!rows.length) return <Empty title="No hay plataformas con precio por duración" text="Las de precio único o “consultar” se editan desde la lista." />
  return (
    <>
      <div className="ptable-wrap">
        <table className="ptable">
          <thead><tr><th>Plataforma</th>{data.options.map(o => <th key={o.id}><b>{o.label}</b><small>{o.period}</small></th>)}</tr></thead>
          <tbody>
            {rows.map(p => (
              <tr key={p.id} className={p.active ? '' : 'is-off'}>
                <th><span className="ptable__name"><img src={p.logo_url || ''} alt="" width="26" height="26" />{p.name}</span></th>
                {data.options.map(o => {
                  const k = key(p.id, o.id); const v = cells[k] ?? cur(p, o)
                  return <td key={o.id}><input className={`pin tnum${cells[k] !== undefined && cells[k] !== cur(p, o) ? ' is-changed' : ''}`} inputMode="decimal" placeholder="—" value={v} disabled={!canEdit}
                    aria-label={`${p.name}, ${o.label} ${o.period}`} onChange={e => setCells(c => ({ ...c, [k]: e.target.value.replace(',', '.').replace(/[^0-9.]/g, '') }))} /></td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pf__hint">Vacío = no se vende en esa duración. Precios en {sym}.</p>
      <div className={`psave${changed.length ? ' is-on' : ''}`}>
        <span><span className="psave__dot" />{changed.length} {changed.length === 1 ? 'precio cambiado' : 'precios cambiados'}</span>
        <div className="psave__acts">
          <button className="key key--sm key--ghost" onClick={() => setCells({})} disabled={saving}>Descartar</button>
          <button className="key key--accent key--sm" onClick={save} disabled={saving || !canEdit}>{saving ? <Loader2 className="spin" size={15} /> : <Check size={15} />} Guardar precios</button>
        </div>
      </div>
    </>
  )
}
