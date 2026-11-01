import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, Loader2, Wallet } from 'lucide-react'
import { usePanel, PageHead } from '../PanelApp'
import { Text, Select, Toggle, ImageInput, ListEditor, Confirm, OrderButtons, moveItem, Empty, Area } from '../ui'
import Sheet from '../../components/Sheet'
import * as api from '../api'

// Valores sugeridos según el tipo de método
const KINDS = {
  yape: { name: 'YAPE', logo: '/library/pay/yape.webp', label: 'Número' },
  plin: { name: 'PLIN', logo: '/library/pay/plin.webp', label: 'Número' },
  bcp: { name: 'BCP', logo: '/library/pay/bcp.webp', label: 'Cuenta' },
  interbank: { name: 'Interbank', logo: null, label: 'Cuenta' },
  bbva: { name: 'BBVA', logo: null, label: 'Cuenta' },
  scotiabank: { name: 'Scotiabank', logo: null, label: 'Cuenta' },
  lemon: { name: 'LEMON', logo: '/library/pay/lemon.webp', label: 'Usuario' },
  binance: { name: 'Binance Pay', logo: '/library/pay/binance.webp', label: 'Pay ID' },
  paypal: { name: 'PayPal', logo: null, label: 'Correo' },
  other: { name: '', logo: null, label: 'Número' },
}

export default function Pagos() {
  const { data, patch, toast, canEdit, tid } = usePanel()
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const list = data.payments
  const move = async (i, d) => {
    const next = moveItem(list, i, d); patch('payments', next); setBusy(true)
    try { await api.reorder('payment_methods', next.map(x => x.id)) } catch (e) { toast(api.niceError(e), 'error') } finally { setBusy(false) }
  }
  const setKind = k => setEdit(e => {
    const prev = KINDS[e.kind] || {}, nx = KINDS[k]
    return { ...e, kind: k, name: !e.name || e.name === prev.name ? nx.name : e.name, logo_url: !e.logo_url || e.logo_url === prev.logo ? nx.logo : e.logo_url, account_label: !e.account_label || e.account_label === prev.label ? nx.label : e.account_label }
  })
  const save = async () => {
    if (!edit.name?.trim()) { toast('Escribe el nombre del método', 'warn'); return }
    setSaving(true)
    try {
      const row = { ...edit, name: edit.name.trim(), account: edit.account?.trim() || null, holder: edit.holder?.trim() || null, note: edit.note?.trim() || null, instructions: (edit.instructions || []).filter(Boolean) }
      const saved = await api.saveRow('payment_methods', tid, row)
      patch('payments', xs => edit.id ? xs.map(x => x.id === edit.id ? saved : x) : [...xs, saved])
      toast('Método guardado'); setEdit(null)
    } catch (e) { toast(api.niceError(e), 'error') } finally { setSaving(false) }
  }
  const set = (k, v) => setEdit(e => ({ ...e, [k]: v }))

  return (
    <>
      <PageHead title="Métodos de pago" text="Aparecen al final del pedido, con su QR para escanear o descargar y el número para copiar."
        actions={<button className="key key--accent" disabled={!canEdit} onClick={() => setEdit({ kind: 'yape', name: 'YAPE', logo_url: KINDS.yape.logo, account_label: 'Número', account: '', holder: '', qr_url: null, note: '', instructions: [], active: true, sort: (list.length + 1) * 10 })}><Plus size={17} /> Agregar método</button>} />
      {list.length === 0 ? <Empty icon={<Wallet size={22} />} title="Sin métodos de pago" text="Agrega al menos uno para que el cliente sepa cómo pagarte." /> : (
        <ul className="prows">
          {list.map((m, i) => (
            <li key={m.id} className={`prow${m.active ? '' : ' is-off'}`}>
              <OrderButtons index={i} total={list.length} onMove={move} disabled={!canEdit || busy} />
              {m.logo_url ? <img className="prow__logo" src={m.logo_url} alt="" width="44" height="44" /> : <span className="prow__logo prow__logo--ph">{m.name?.[0]}</span>}
              <button className="prow__main" onClick={() => setEdit({ ...m })}>
                <b>{m.name}{m.qr_url && <span className="ptag">Con QR</span>}{!m.active && <span className="ptag is-muted">Oculto</span>}</b>
                <small>{m.account ? `${m.account_label}: ${m.account}` : 'Sin número'}{m.holder ? ` · ${m.holder}` : ''}</small>
              </button>
              <button className="key key--icon key--sm" onClick={() => setEdit({ ...m })} aria-label={`Editar ${m.name}`}><Pencil size={15} /></button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} variant="drawer" title={edit?.id ? `Editar ${edit.name}` : 'Nuevo método de pago'}
        footer={<div className="peditor__foot">
          {edit?.id && <button className="key key--icon" onClick={() => setDel(edit)} disabled={!canEdit} aria-label="Eliminar"><Trash2 size={17} /></button>}
          <button className="key key--accent key--lg" style={{ flex: 1 }} onClick={save} disabled={saving || !canEdit}>{saving ? <Loader2 className="spin" size={17} /> : <Check size={17} />} Guardar</button>
        </div>}>
        {edit && <fieldset className="pform" disabled={!canEdit}><div className="pfields">
          <Select label="Tipo" value={edit.kind} onChange={setKind} options={Object.entries(KINDS).map(([k, v]) => ({ value: k, label: v.name || 'Otro' }))} />
          <Text label="Nombre visible" value={edit.name} onChange={v => set('name', v)} max={30} />
          <Text label="Qué se copia" hint="Número, Cuenta, CCI, Pay ID…" value={edit.account_label} onChange={v => set('account_label', v)} max={20} />
          <Text label={edit.account_label || 'Número'} value={edit.account} onChange={v => set('account', v)} max={40} />
          <Text label="Titular" value={edit.holder} onChange={v => set('holder', v)} max={60} wide />
          <ImageInput label="Código QR" hint="Foto o captura del QR. El cliente podrá ampliarlo y descargarlo." value={edit.qr_url} onChange={v => set('qr_url', v)} tid={tid} kind="qr" max={900} canEdit={canEdit} />
          <ImageInput label="Logo" value={edit.logo_url} onChange={v => set('logo_url', v)} tid={tid} kind="paylogo" max={256} canEdit={canEdit} />
          <Area label="Nota" hint="Por ejemplo: “Solo transferencias del mismo banco”." value={edit.note} onChange={v => set('note', v)} max={160} rows={2} />
          <ListEditor label="Pasos para pagar (opcional)" items={edit.instructions || []} onChange={v => set('instructions', v)} />
          <Toggle label="Visible" checked={edit.active} onChange={v => set('active', v)} />
        </div></fieldset>}
      </Sheet>
      <Confirm open={!!del} title={`¿Eliminar ${del?.name}?`} text="Ya no aparecerá al pagar. Si solo quieres ocultarlo un tiempo, apaga “Visible”."
        onClose={() => setDel(null)} onConfirm={async () => {
          try { await api.deleteRow('payment_methods', del.id); patch('payments', xs => xs.filter(x => x.id !== del.id)); setDel(null); setEdit(null); toast('Método eliminado') } catch (e) { toast(api.niceError(e), 'error') }
        }} />
    </>
  )
}
