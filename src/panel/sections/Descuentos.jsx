import { useState } from 'react'
import { Plus, Trash2, Check, Loader2, Percent } from 'lucide-react'
import { usePanel, PageHead } from '../PanelApp'
import { Toggle, Banner, Explain } from '../ui'
import { money } from '../../lib/format'
import * as api from '../api'

export default function Descuentos() {
  const { data, patch, toast, canEdit, tid, sym } = usePanel()
  const [rules, setRules] = useState(() => data.rules.map(r => ({ ...r, discount: String(r.discount) })))
  const [saving, setSaving] = useState(false)
  const on = data.settings.discounts_enabled
  const dirty = JSON.stringify(rules) !== JSON.stringify(data.rules.map(r => ({ ...r, discount: String(r.discount) })))

  const toggle = async v => {
    try { const s = await api.saveSettings(tid, { discounts_enabled: v }); patch('settings', s); toast(v ? 'Descuentos activados' : 'Descuentos apagados') }
    catch (e) { toast(api.niceError(e), 'error') }
  }
  const toggleCat = async c => {
    try { const s = await api.saveRow('categories', tid, { ...c, combo_eligible: !c.combo_eligible }); patch('categories', cs => cs.map(x => x.id === c.id ? s : x)) }
    catch (e) { toast(api.niceError(e), 'error') }
  }
  const save = async () => {
    const bad = rules.find(r => !(Number(r.min_items) >= 2) || !(Number(r.discount) >= 0) || r.discount === '')
    if (bad) { toast('Cada regla necesita 2 o más plataformas y un monto', 'warn'); return }
    const mins = rules.map(r => Number(r.min_items))
    if (new Set(mins).size !== mins.length) { toast('Hay dos reglas con la misma cantidad', 'warn'); return }
    setSaving(true)
    try {
      for (const r of data.rules.filter(x => !rules.some(y => y.id === x.id))) await api.deleteRow('discount_rules', r.id)
      const saved = []
      for (const r of rules) saved.push(await api.saveRow('discount_rules', tid, { ...r, min_items: Number(r.min_items), discount: Number(r.discount), label: r.label?.trim() || null }))
      saved.sort((a, b) => a.min_items - b.min_items)
      patch('rules', saved); setRules(saved.map(r => ({ ...r, discount: String(r.discount) }))); toast('Reglas guardadas')
    } catch (e) { toast(api.niceError(e), 'error') } finally { setSaving(false) }
  }
  const upd = (i, k, v) => setRules(rs => rs.map((r, j) => j === i ? { ...r, [k]: v } : r))
  const eligible = data.categories.filter(c => c.combo_eligible).map(c => c.name)

  return (
    <>
      <PageHead title="Descuentos por cantidad" text="Opcional. Si los activas, el carrito descuenta solo cuando el cliente lleva varias plataformas." />
      <Explain steps={[['Actívalos', 'Vienen apagados. Mientras estén apagados, nadie recibe descuento.'], ['Define las reglas', 'Ejemplo: desde 2 plataformas, S/ 1 menos; desde 3, S/ 2 menos.'], ['El carrito descuenta solo', 'Solo cuentan las categorías que marques abajo. Los combos tienen su propio precio y no suman.']]} />
      <section className="pcard">
        <Toggle label="Activar descuentos por cantidad" hint={on ? 'Están activos: el catálogo los muestra y el carrito los aplica.' : 'Apagados: el cliente paga la suma normal. Tus combos siguen con su precio.'} checked={on} onChange={toggle} disabled={!canEdit} />
      </section>
      <fieldset className="pform" disabled={!canEdit}>
        <section className={`pcard${on ? '' : ' is-dim'}`}>
          <div className="pcard__head"><h2>Reglas</h2>
            <button className="key key--sm" onClick={() => setRules(rs => [...rs, { min_items: String(Math.max(1, ...rs.map(r => Number(r.min_items))) + 1), discount: '', label: '', active: true }])}><Plus size={15} /> Agregar regla</button>
          </div>
          {rules.length === 0 && <p className="pmuted">Sin reglas. Ejemplo: 2 plataformas → S/ 1.00 menos.</p>}
          <ul className="prules">
            {rules.map((r, i) => (
              <li key={r.id || `n${i}`}>
                <label><small>Desde</small><span className="pin-unit"><input className="pin tnum" inputMode="numeric" value={r.min_items} onChange={e => upd(i, 'min_items', e.target.value.replace(/\D/g, '').slice(0, 2))} aria-label="Cantidad mínima" /><em>plataformas</em></span></label>
                <label><small>Descuento</small><span className="pin-money"><span>{sym}</span><input className="pin tnum" inputMode="decimal" value={r.discount} onChange={e => upd(i, 'discount', e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))} aria-label="Monto de descuento" /></span></label>
                <label className="prules__name"><small>Nombre (opcional)</small><input className="pin" value={r.label || ''} onChange={e => upd(i, 'label', e.target.value)} placeholder="Combo dúo" maxLength={30} /></label>
                <button className="key key--icon key--sm key--ghost" onClick={() => setRules(rs => rs.filter((_, j) => j !== i))} aria-label="Quitar regla"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
          {rules.length > 0 && <p className="pf__hint">Así lo verá el cliente: {rules.filter(r => r.discount).sort((a, b) => a.min_items - b.min_items).map(r => `${r.min_items} plataformas: −${money(r.discount, sym)}`).join(' · ') || '—'}</p>}
          {dirty && <div className="pcard__foot"><button className="key key--accent" onClick={save} disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Check size={16} />} Guardar reglas</button></div>}
        </section>
        <section className={`pcard${on ? '' : ' is-dim'}`}>
          <h2 className="pcard__title">¿Qué plataformas cuentan?</h2>
          <p className="pmuted" style={{ marginBottom: 12 }}>Solo suman las de estas categorías. Así evitas descontar en herramientas o servicios con poco margen.</p>
          <div className="pfields">
            {data.categories.map(c => <Toggle key={c.id} label={c.name} checked={c.combo_eligible} onChange={() => toggleCat(c)} disabled={!canEdit} />)}
          </div>
          {on && !eligible.length && <Banner tone="warn" icon={<Percent size={18} />}>Ninguna categoría cuenta: el descuento nunca se aplicará.</Banner>}
        </section>
      </fieldset>
    </>
  )
}
