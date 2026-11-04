import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Trash2, ArrowLeft, Copy, Download, Tag, Send, ShoppingBag } from 'lucide-react'
import Sheet from './Sheet'
import { buildOrderMessage, waLink } from '../lib/cart'
import { money, store } from '../lib/format'
import { copyText } from '../lib/clipboard'

export default function CartSheet({ open, onClose, summary, cat, sym, dispatch, slug, toast }) {
  const [step, setStep] = useState('cart')
  const [name, setName] = useState(() => store.get(`cs-name:${slug}`, ''))
  const methods = cat.payment_methods || []
  const [methodId, setMethodId] = useState(methods[0]?.id)
  const [zoom, setZoom] = useState(null)
  const [sure, setSure] = useState(false)
  const method = methods.find(m => m.id === methodId)
  const settings = cat.settings

  useEffect(() => { if (open) { setStep('cart'); setSure(false) } }, [open])
  useEffect(() => { if (!sure) return; const t = setTimeout(() => setSure(false), 4000); return () => clearTimeout(t) }, [sure])
  useEffect(() => { if (!summary.count && step !== 'sent') setStep('cart') }, [summary.count]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { store.set(`cs-name:${slug}`, name) }, [name, slug])

  const message = useMemo(() => buildOrderMessage({ summary, settings, name, method }), [summary, settings, name, method])
  const canSend = summary.count > 0 && Boolean(settings.whatsapp)

  const copy = async (text, label) => { if (await copyText(text)) toast(`${label} copiado`) }

  const lines = (
    summary.rows.length === 0 ? (
      <div className="empty">
        <ShoppingBag size={34} style={{ margin: '0 auto 10px', color: 'var(--faint)' }} />
        <b>Tu carrito está vacío</b>
        Agrega una plataforma para empezar.
      </div>
    ) : (
      <div>
        <div className="cart-top">
          <span className="tnum">{summary.count} {summary.count === 1 ? 'producto' : 'productos'}</span>
          {sure ? (
            <span className="cart-top__ask" role="group" aria-label="Confirmar vaciar carrito">
              ¿Vaciar todo?
              <button className="key key--ghost key--sm" onClick={() => setSure(false)}>No</button>
              <button className="key key--sm cart-top__yes" onClick={() => { dispatch({ type: 'clear' }); setSure(false); toast('Carrito vacío') }}>Sí, vaciar</button>
            </span>
          ) : (
            <button className="cart-top__clear" onClick={() => setSure(true)}><Trash2 size={14} /> Vaciar carrito</button>
          )}
        </div>
        {summary.rows.map(r => (
          <div className="cart-line" key={r.key}>
            {r.kind === 'combo' ? (
              <span className="cart-line__stack">{r.logos.slice(0, 3).map(p => <img key={p.id} src={p.logo_url} alt="" width="30" height="30" />)}</span>
            ) : <img className="cart-line__logo" src={r.logos[0]?.logo_url} alt="" width="44" height="44" />}
            <div className="cart-line__txt"><b>{r.name}</b><small>{r.detail}</small></div>
            <div className="mini-step" role="group" aria-label={`Cantidad de ${r.name}`}>
              <button onClick={() => dispatch({ type: 'dec', key: r.key })} aria-label="Quitar uno">
                {r.qty === 1 ? <Trash2 size={15} /> : <Minus size={15} />}
              </button>
              <output className="tnum">{r.qty}</output>
              <button onClick={() => dispatch({ type: 'add', line: r })} aria-label="Agregar uno"><Plus size={15} /></button>
            </div>
            <span className="cart-line__price tnum">{money(r.unit * r.qty, sym)}</span>
          </div>
        ))}
        {summary.nextRule && (
          <div className="hint"><Tag size={18} />
            <span>Agrega {summary.nextRule.missing} más de streaming o música y ahorras {money(summary.nextRule.discount, sym)}.</span>
          </div>
        )}
      </div>
    )
  )

  const totals = (
    <div className="totals tnum" aria-live="polite">
      {summary.discount > 0 && <div><span>Subtotal</span><span>{money(summary.subtotal, sym)}</span></div>}
      {summary.discount > 0 && <div className="is-off"><span>Descuento{summary.rule?.label ? ` · ${summary.rule.label}` : ''}</span><span>−{money(summary.discount, sym)}</span></div>}
      <div className="is-total"><span>Total</span><span>{money(summary.total, sym)}</span></div>
    </div>
  )

  const pay = (
    <div>
      <div className="field">
        <label htmlFor="buyer">Tu nombre</label>
        <input id="buyer" value={name} onChange={e => setName(e.target.value.slice(0, 40))} placeholder="Para saludarte en WhatsApp" autoComplete="given-name" />
      </div>
      {methods.length > 0 && <>
        <p className="pay-q">¿Cómo vas a pagar?</p>
        <div className="methods" role="group" aria-label="Método de pago">
          {methods.map(m => (
            <button key={m.id} className="method" aria-pressed={m.id === methodId} onClick={() => setMethodId(m.id)}>
              {m.logo_url && <img src={m.logo_url} alt="" width="38" height="38" />}{m.name}
            </button>
          ))}
        </div>
      </>}
      {method && (
        <div className={`paybox${method.qr_url ? ' has-qr' : ''}`}>
          {method.qr_url && (
            <button className="paybox__qr" onClick={() => setZoom(method)} aria-label={`Ampliar QR de ${method.name}`}>
              <img src={method.qr_url} alt={`QR de ${method.name}`} />
            </button>
          )}
          <div>
            {method.account ? (
              <div className="copy-row">
                <div><small>{method.account_label}</small><b className="tnum">{method.account}</b></div>
                <button className="key key--sm" onClick={() => copy(method.account, method.account_label)}><Copy size={15} /> Copiar</button>
              </div>
            ) : method.note && <div className="note"><p>{method.note}</p></div>}
            {method.holder && <p className="paybox__holder">Titular: <b>{method.holder}</b></p>}
            {method.account && method.note && <p className="paybox__holder">{method.note}</p>}
            <p className="paybox__holder">Monto exacto: <b className="tnum">{money(summary.total, sym)}</b></p>
          </div>
        </div>
      )}
      <div className="preview-label"><span>Así llegará tu mensaje</span>
        <button className="key key--ghost key--sm" onClick={() => copy(message, 'Pedido')}><Copy size={14} /> Copiar</button>
      </div>
      <div className="preview">{message}</div>
    </div>
  )

  return (
    <>
      <Sheet open={open} onClose={onClose} variant="drawer"
        title={step === 'cart' ? 'Tu carrito' : step === 'pay' ? 'Pagar y enviar' : 'Pedido listo'}
        head={step === 'pay' && <button className="key key--icon key--sm" onClick={() => setStep('cart')} aria-label="Volver al carrito"><ArrowLeft size={18} /></button>}
        footer={step === 'sent' ? (
          <div className="row-2">
            <a className="key key--lg" href={waLink(settings.whatsapp, message)} target="_blank" rel="noopener noreferrer"><Send size={17} /> Reabrir</a>
            <button className="key key--accent key--lg" onClick={() => { dispatch({ type: 'clear' }); setStep('cart'); onClose() }}>Vaciar carrito y seguir</button>
          </div>
        ) : summary.count > 0 && (
          <>
            {totals}
            {step === 'cart'
              ? <button className="key key--accent key--block key--lg" onClick={() => setStep('pay')}>Continuar al pago</button>
              : <a className={`key key--wa key--block key--lg${canSend ? '' : ' is-disabled'}`} aria-disabled={!canSend}
                  href={canSend ? waLink(settings.whatsapp, message) : undefined} target="_blank" rel="noopener noreferrer"
                  onClick={() => { if (canSend) setTimeout(() => setStep('sent'), 350) }}>
                  <Send size={18} /> Enviar pedido por WhatsApp
                </a>}
          </>
        )}>
        {step === 'cart' ? lines : step === 'pay' ? pay : (
          <div className="done">
            <svg className="done__check" viewBox="0 0 52 52" aria-hidden="true">
              <circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" />
            </svg>
            <h3>¡Tu pedido está en WhatsApp!</h3>
            <p>Envía el mensaje{method ? ` y adjunta tu comprobante de ${method.name}` : ''}. Te respondemos{settings.delivery_time ? ` en ${settings.delivery_time}` : ' en breve'}.</p>
            <p className="done__total tnum">Total: <b>{money(summary.total, sym)}</b></p>
          </div>
        )}
      </Sheet>
      <Sheet open={!!zoom} onClose={() => setZoom(null)} title={zoom ? `QR de ${zoom.name}` : ''}
        footer={zoom && <a className="key key--block key--lg" href={zoom.qr_url} download={`QR-${zoom.name}.webp`}><Download size={18} /> Descargar QR</a>}>
        {zoom && <div style={{ background: '#fff', borderRadius: 16, padding: 12 }}><img src={zoom.qr_url} alt={`QR de ${zoom.name}`} style={{ width: '100%', maxWidth: 420, margin: '0 auto' }} /></div>}
        {zoom?.holder && <p className="paybox__holder" style={{ textAlign: 'center' }}>Titular: <b>{zoom.holder}</b></p>}
      </Sheet>
    </>
  )
}

