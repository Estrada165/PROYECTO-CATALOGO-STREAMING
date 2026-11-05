import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, Loader2, Star } from 'lucide-react'
import { usePanel, PageHead } from '../PanelApp'
import { Text, Select, Toggle, Confirm, OrderButtons, moveItem, Empty, Explain } from '../ui'
import Sheet from '../../components/Sheet'
import * as api from '../api'
import { CAT_ICONS, catIcon } from '../../components/CategoryFilter'

const ACCESS = [{ value: 'profile', label: 'Perfil (acceso compartido)' }, { value: 'complete', label: 'Cuenta completa' }, { value: 'other', label: 'Otro' }]
const DAY_PRESETS = [['1 mes', 30], ['2 meses', 60], ['3 meses', 90], ['6 meses', 180], ['12 meses', 365]]

export default function Opciones() {
  return (
    <>
      <PageHead title="Duraciones y categorías" text="Las duraciones son los botones que el cliente ve arriba del catálogo (Perfil · 1 mes, Cuenta completa · 1 mes…). Las categorías salen como filtro al lado (Streaming, Música…). Cada plataforma se asigna a una categoría desde Plataformas." />
      <Explain steps={[['Cada duración es un botón', 'Tipo de acceso + tiempo: “Perfil · 1 mes”.'], ['Los precios van en cada plataforma', 'Si una plataforma no tiene precio en una duración, ahí no aparece.'], ['El número marca el orden', 'El 1 aparece primero. Toca el número para moverlo.']]} />
      <Durations />
      <Categories />
    </>
  )
}

function useList(table, key) {
  const { data, patch, toast, tid } = usePanel()
  const [busy, setBusy] = useState(false)
  const move = async (i, d) => {
    const next = moveItem(data[key], i, d)
    patch(key, next); setBusy(true)
    try { await api.reorder(table, next.map(x => x.id)) } catch (e) { toast(api.niceError(e), 'error') } finally { setBusy(false) }
  }
  const save = async row => {
    const saved = await api.saveRow(table, tid, row)
    patch(key, xs => row.id ? xs.map(x => x.id === row.id ? { ...x, ...saved } : x) : [...xs, saved])
    return saved
  }
  const remove = async id => { await api.deleteRow(table, id); patch(key, xs => xs.filter(x => x.id !== id)) }
  return { items: data[key], move, save, remove, busy }
}

function Durations() {
  const { canEdit, toast, data, patch, reload } = usePanel()
  const { items, move, save, remove, busy } = useList('plan_options', 'options')
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [saving, setSaving] = useState(false)
  const priced = id => data.platforms.filter(p => p.prices.some(r => r.option_id === id)).length

  const submit = async () => {
    if (!edit.label.trim() || !edit.period.trim()) { toast('Completa el nombre y la duración', 'warn'); return }
    setSaving(true)
    try {
      await save({ ...edit, label: edit.label.trim(), period: edit.period.trim(), days: Number(edit.days) || 30 })
      if (edit.is_default) await reload() // la base desmarca las demás
      toast('Duración guardada'); setEdit(null)
    } catch (e) { toast(api.niceError(e), 'error') } finally { setSaving(false) }
  }
  return (
    <section className="pcard">
      <div className="pcard__head"><h2>Duraciones</h2>
        <button className="key key--sm" disabled={!canEdit} onClick={() => setEdit({ label: 'Perfil', period: '1 mes', access_type: 'profile', days: 30, active: true, is_default: false, sort: (items.length + 1) * 10 })}><Plus size={15} /> Agregar</button>
      </div>
      {items.length === 0 ? <Empty title="Sin duraciones" text="Agrega al menos una para poder poner precios." /> : (
        <ul className="prows prows--flat">
          {items.map((o, i) => (
            <li key={o.id} className={`prow${o.active ? '' : ' is-off'}`}>
              <OrderButtons index={i} total={items.length} onMove={move} disabled={!canEdit || busy} />
              <button className="prow__main" onClick={() => setEdit({ ...o })}>
                <b>{o.label} · {o.period}{o.is_default && <span className="ptag"><Star size={11} /> Se abre primero</span>}{!o.active && <span className="ptag is-muted">Oculta</span>}</b>
                <small>{o.days} días · {priced(o.id)} plataformas con precio</small>
              </button>
              <button className="key key--icon key--sm" onClick={() => setEdit({ ...o })} aria-label={`Editar ${o.label} ${o.period}`}><Pencil size={15} /></button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar duración' : 'Nueva duración'}
        footer={<div className="peditor__foot">
          {edit?.id && <button className="key key--icon" onClick={() => setDel(edit)} disabled={!canEdit} aria-label="Eliminar"><Trash2 size={17} /></button>}
          <button className="key key--accent key--lg" style={{ flex: 1 }} onClick={submit} disabled={saving || !canEdit}>{saving ? <Loader2 className="spin" size={17} /> : <Check size={17} />} Guardar</button>
        </div>}>
        {edit && <fieldset className="pform" disabled={!canEdit}><div className="pfields">
          <Text label="Nombre del botón" hint="Lo grande: Perfil, Cuenta completa, Pantalla…" value={edit.label} onChange={v => setEdit(e => ({ ...e, label: v }))} max={24} />
          <Text label="Duración visible" hint="Lo pequeño: 1 mes, 2 meses promo…" value={edit.period} onChange={v => setEdit(e => ({ ...e, period: v }))} max={24} />
          <div className="pquick pf--wide">{DAY_PRESETS.map(([l, dd]) => <button key={l} type="button" className="pchip pchip--btn" onClick={() => setEdit(e => ({ ...e, period: l, days: dd }))}>{l}</button>)}</div>
          <Text label="Días que dura" inputMode="numeric" value={String(edit.days ?? '')} onChange={v => setEdit(e => ({ ...e, days: v.replace(/\D/g, '').slice(0, 4) }))} hint="Se usa para calcular vencimientos." />
          <Select label="Tipo de acceso" value={edit.access_type} onChange={v => setEdit(e => ({ ...e, access_type: v }))} options={ACCESS} />
          <Toggle label="Se abre primero" hint="Es la duración seleccionada al entrar al catálogo." checked={edit.is_default} onChange={v => setEdit(e => ({ ...e, is_default: v }))} />
          <Toggle label="Visible" checked={edit.active} onChange={v => setEdit(e => ({ ...e, active: v }))} />
        </div></fieldset>}
      </Sheet>
      <Confirm open={!!del} title={`¿Eliminar ${del?.label} · ${del?.period}?`} text={`Se borran también sus precios (${del ? priced(del.id) : 0} plataformas) y los combos de esa duración. Si solo quieres ocultarla, usa “Visible”.`}
        onClose={() => setDel(null)} onConfirm={async () => {
          try { await remove(del.id); patch('platforms', ps => ps.map(p => ({ ...p, prices: p.prices.filter(r => r.option_id !== del.id) }))); patch('combos', cs => cs.filter(c => c.option_id !== del.id)); setDel(null); setEdit(null); toast('Duración eliminada') }
          catch (e) { toast(api.niceError(e), 'error') }
        }} />
    </section>
  )
}

function Categories() {
  const { canEdit, toast, data, patch } = usePanel()
  const { items, move, save, remove, busy } = useList('categories', 'categories')
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [saving, setSaving] = useState(false)
  const count = id => data.platforms.filter(p => p.category_id === id).length
  const submit = async () => {
    if (!edit.name.trim()) { toast('Escribe el nombre', 'warn'); return }
    setSaving(true)
    try { await save({ ...edit, name: edit.name.trim() }); toast('Categoría guardada'); setEdit(null) }
    catch (e) { toast(api.niceError(e), 'error') } finally { setSaving(false) }
  }
  return (
    <section className="pcard">
      <div className="pcard__head"><h2>Categorías</h2>
        <button className="key key--sm" disabled={!canEdit} onClick={() => setEdit({ name: '', icon: 'sparkles', combo_eligible: false, active: true, sort: (items.length + 1) * 10 })}><Plus size={15} /> Agregar</button>
      </div>
      <ul className="prows prows--flat">
        {items.map((c, i) => (
          <li key={c.id} className={`prow${c.active ? '' : ' is-off'}`}>
            <OrderButtons index={i} total={items.length} onMove={move} disabled={!canEdit || busy} />
            <span className="pcat-ic" aria-hidden="true">{(() => { const Ic = catIcon(c.icon); return <Ic size={17} /> })()}</span>
            <button className="prow__main" onClick={() => setEdit({ ...c })}>
              <b>{c.name}{!c.active && <span className="ptag is-muted">Oculta</span>}</b>
              <small>{count(c.id)} plataformas{c.combo_eligible ? ' · cuenta para descuentos' : ''}</small>
            </button>
            <button className="key key--icon key--sm" onClick={() => setEdit({ ...c })} aria-label={`Editar ${c.name}`}><Pencil size={15} /></button>
          </li>
        ))}
      </ul>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar categoría' : 'Nueva categoría'}
        footer={<div className="peditor__foot">
          {edit?.id && <button className="key key--icon" onClick={() => setDel(edit)} disabled={!canEdit} aria-label="Eliminar"><Trash2 size={17} /></button>}
          <button className="key key--accent key--lg" style={{ flex: 1 }} onClick={submit} disabled={saving || !canEdit}>{saving ? <Loader2 className="spin" size={17} /> : <Check size={17} />} Guardar</button>
        </div>}>
        {edit && <fieldset className="pform" disabled={!canEdit}><div className="pfields">
          <Text label="Nombre" value={edit.name} onChange={v => setEdit(e => ({ ...e, name: v }))} max={24} wide />
          <div className="pf pf--wide"><span className="pf__label">Ícono del filtro</span>
            <div className="pcat-icons" role="radiogroup" aria-label="Ícono de la categoría">
              {Object.entries(CAT_ICONS).map(([k, Ic]) => (
                <button key={k} type="button" role="radio" aria-checked={(edit.icon || 'sparkles') === k} aria-label={k} onClick={() => setEdit(e => ({ ...e, icon: k }))}><Ic size={18} /></button>
              ))}
            </div>
          </div>
          <Toggle label="Cuenta para descuentos por cantidad" hint="Solo aplica si activas los descuentos." checked={edit.combo_eligible} onChange={v => setEdit(e => ({ ...e, combo_eligible: v }))} />
          <Toggle label="Visible" checked={edit.active} onChange={v => setEdit(e => ({ ...e, active: v }))} />
        </div></fieldset>}
      </Sheet>
      <Confirm open={!!del} title={`¿Eliminar ${del?.name}?`} text={`Sus ${del ? count(del.id) : 0} plataformas quedan sin categoría (no se borran).`}
        onClose={() => setDel(null)} onConfirm={async () => {
          try { await remove(del.id); patch('platforms', ps => ps.map(p => p.category_id === del.id ? { ...p, category_id: null } : p)); setDel(null); setEdit(null); toast('Categoría eliminada') } catch (e) { toast(api.niceError(e), 'error') }
        }} />
    </section>
  )
}
