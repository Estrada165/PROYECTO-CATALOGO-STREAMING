import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Check, Loader2, Boxes, Search, X } from 'lucide-react'
import { usePanel, PageHead } from '../PanelApp'
import { Text, Area, Select, Toggle, Money, Confirm, OrderButtons, moveItem, Empty, Field, norm, Explain } from '../ui'
import Sheet from '../../components/Sheet'
import { money } from '../../lib/format'
import * as api from '../api'

const priceOf = (p, oid) => { const r = p?.prices.find(x => x.option_id === oid); return r ? Number(r.price) : null }

export default function Combos() {
  const { data, patch, toast, canEdit, tid, sym } = usePanel()
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [busy, setBusy] = useState(false)
  const byId = useMemo(() => Object.fromEntries(data.platforms.map(p => [p.id, p])), [data.platforms])
  const opt = id => data.options.find(o => o.id === id)

  const move = async (i, d) => {
    const next = moveItem(data.combos, i, d); patch('combos', next); setBusy(true)
    try { await api.reorder('combos', next.map(c => c.id)) } catch (e) { toast(api.niceError(e), 'error') } finally { setBusy(false) }
  }
  const sumOf = c => c.platform_ids.reduce((a, id) => a + (priceOf(byId[id], c.option_id) ?? 0), 0)

  return (
    <>
      <PageHead title="Combos" text="Paquetes de varias plataformas con un precio especial. Entran al carrito como un solo producto."
        actions={<button className="key key--accent" disabled={!canEdit || !data.options.length} onClick={() => setEdit({ name: '', description: '', badge: '', option_id: data.options.find(o => o.is_default)?.id || data.options[0]?.id, custom_price: '', platform_ids: [], active: true, sort: (data.combos.length + 1) * 10 })}><Plus size={17} /> Nuevo combo</button>} />
      <Explain steps={[['Elige la duración', 'El combo vale para una duración, por ejemplo Perfil · 1 mes.'], ['Junta las plataformas', '2 o más que tengan precio en esa duración.'], ['Pon tu precio', 'Te mostramos la suma normal y cuánto ahorra el cliente.']]} />
      {data.combos.length === 0 ? <Empty icon={<Boxes size={22} />} title="Aún no tienes combos" text="Junta 2 o 3 plataformas que se vendan bien juntas, como Netflix + Spotify." /> : (
        <ul className="prows">
          {data.combos.map((c, i) => {
            const sum = sumOf(c), price = c.custom_price != null ? Number(c.custom_price) : sum
            return (
              <li key={c.id} className={`prow${c.active ? '' : ' is-off'}`}>
                <OrderButtons index={i} total={data.combos.length} onMove={move} disabled={!canEdit || busy} />
                <span className="pstack">{c.platform_ids.slice(0, 3).map(id => <img key={id} src={byId[id]?.logo_url || ''} alt="" width="30" height="30" />)}</span>
                <button className="prow__main" onClick={() => setEdit({ ...c, custom_price: c.custom_price != null ? String(c.custom_price) : '', badge: c.badge || '' })}>
                  <b>{c.name}{!c.active && <span className="ptag is-muted">Oculto</span>}</b>
                  <small>{opt(c.option_id) ? `${opt(c.option_id).label} · ${opt(c.option_id).period}` : 'Sin duración'} · {money(price, sym)}{price < sum && <em className="pok"> ahorra {money(sum - price, sym)}</em>}</small>
                </button>
                <button className="key key--icon key--sm" onClick={() => setEdit({ ...c, custom_price: c.custom_price != null ? String(c.custom_price) : '', badge: c.badge || '' })} aria-label={`Editar ${c.name}`}><Pencil size={15} /></button>
              </li>
            )
          })}
        </ul>
      )}
      <ComboEditor edit={edit} setEdit={setEdit} onDelete={setDel} byId={byId} />
      <Confirm open={!!del} title={`¿Eliminar ${del?.name}?`} text="El combo desaparece del catálogo. Las plataformas no se tocan."
        onClose={() => setDel(null)} onConfirm={async () => {
          try { await api.deleteRow('combos', del.id); patch('combos', cs => cs.filter(x => x.id !== del.id)); setDel(null); setEdit(null); toast('Combo eliminado') } catch (e) { toast(api.niceError(e), 'error') }
        }} />
    </>
  )
}

function ComboEditor({ edit, setEdit, onDelete, byId }) {
  const { data, patch, toast, canEdit, tid, sym } = usePanel()
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState('')
  const e = edit || {}
  const set = (k, v) => setEdit(o => ({ ...o, [k]: v }))
  const available = data.platforms.filter(p => p.active && priceOf(p, e.option_id) != null)
  const sum = (e.platform_ids || []).reduce((a, id) => a + (priceOf(byId[id], e.option_id) ?? 0), 0)
  const missing = (e.platform_ids || []).filter(id => priceOf(byId[id], e.option_id) == null)
  const price = e.custom_price === '' ? null : Number(e.custom_price)
  const res = available.filter(p => !(e.platform_ids || []).includes(p.id) && (!q || norm(p.name).includes(norm(q)))).slice(0, 8)

  const save = async () => {
    if (!e.name?.trim()) { toast('Ponle un nombre al combo', 'warn'); return }
    if ((e.platform_ids || []).length < 2) { toast('Elige al menos 2 plataformas', 'warn'); return }
    if (missing.length) { toast('Hay plataformas sin precio en esta duración', 'warn'); return }
    setSaving(true)
    try {
      const saved = await api.saveCombo(tid, { ...e, name: e.name.trim(), badge: e.badge?.trim() || null, description: e.description?.trim() || null, custom_price: price })
      const full = { ...saved, platform_ids: e.platform_ids }
      patch('combos', cs => e.id ? cs.map(x => x.id === e.id ? full : x) : [...cs, full])
      toast('Combo guardado'); setEdit(null); setQ('')
    } catch (er) { toast(api.niceError(er), 'error') } finally { setSaving(false) }
  }

  return (
    <Sheet open={!!edit} onClose={() => { setEdit(null); setQ('') }} variant="drawer" title={e.id ? 'Editar combo' : 'Nuevo combo'}
      footer={<div className="peditor__foot">
        {e.id && <button className="key key--icon" onClick={() => onDelete(e)} disabled={!canEdit} aria-label="Eliminar combo"><Trash2 size={17} /></button>}
        <button className="key key--accent key--lg" style={{ flex: 1 }} onClick={save} disabled={saving || !canEdit}>{saving ? <Loader2 className="spin" size={17} /> : <Check size={17} />} Guardar combo</button>
      </div>}>
      {edit && <fieldset className="pform" disabled={!canEdit}><div className="pfields">
        <Text label="Nombre" value={e.name} onChange={v => set('name', v)} placeholder="Dúo Entretenimiento" max={50} />
        <Text label="Etiqueta pequeña" value={e.badge} onChange={v => set('badge', v)} placeholder="Más popular" max={24} />
        <Area label="Descripción" value={e.description} onChange={v => set('description', v)} max={140} rows={2} />
        <Select label="Duración" value={e.option_id} onChange={v => set('option_id', v)} options={data.options.map(o => ({ value: o.id, label: `${o.label} · ${o.period}` }))} />
        <Field label={`Plataformas (${(e.platform_ids || []).length})`} hint="Solo aparecen las que tienen precio en esta duración." wide>
          <div className="ppicked">
            {(e.platform_ids || []).map(id => (
              <span key={id} className={`pchip pchip--logo${missing.includes(id) ? ' is-bad' : ''}`}>
                <img src={byId[id]?.logo_url || ''} alt="" width="22" height="22" />{byId[id]?.name || 'Eliminada'}
                <small className="tnum">{priceOf(byId[id], e.option_id) != null ? money(priceOf(byId[id], e.option_id), sym) : 'sin precio'}</small>
                <button type="button" onClick={() => set('platform_ids', e.platform_ids.filter(x => x !== id))} aria-label={`Quitar ${byId[id]?.name}`}><X size={13} /></button>
              </span>
            ))}
          </div>
          <div className="psearch"><Search size={16} /><input className="pin" placeholder="Agregar plataforma…" value={q} onChange={ev => setQ(ev.target.value)} aria-label="Buscar plataforma para el combo" /></div>
          <div className="ppick">
            {res.map(p => (
              <button type="button" key={p.id} onClick={() => { set('platform_ids', [...(e.platform_ids || []), p.id]); setQ('') }}>
                <img src={p.logo_url || ''} alt="" width="26" height="26" /><span>{p.name}</span><small className="tnum">{money(priceOf(p, e.option_id), sym)}</small><Plus size={15} />
              </button>
            ))}
          </div>
        </Field>
        <div className="pcombo-calc pf--wide">
          <div><small>Suma normal</small><b className="tnum">{money(sum, sym)}</b></div>
          <Money label="Precio del combo" sym={sym} value={e.custom_price} onChange={v => set('custom_price', v)} placeholder={sum.toFixed(2)} />
          <div className={price != null && price < sum ? 'is-ok' : ''}><small>El cliente ahorra</small><b className="tnum">{money(price != null ? Math.max(0, sum - price) : 0, sym)}</b></div>
        </div>
        {price != null && price > sum && <p className="pf__error pf--wide">El combo cuesta más que comprar por separado.</p>}
        <Toggle label="Visible en el catálogo" checked={e.active} onChange={v => set('active', v)} />
      </div></fieldset>}
    </Sheet>
  )
}
