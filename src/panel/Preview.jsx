import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Smartphone, Monitor, Moon, Sun, RotateCw } from 'lucide-react'

// Vista previa en vivo del catálogo real. Los cambios sin guardar viajan por postMessage.
export default function Preview({ slug, settings, patch, height = 640 }) {
  const frame = useRef(null), box = useRef(null)
  const [device, setDevice] = useState('mobile')
  const [theme, setTheme] = useState(null)
  const [ready, setReady] = useState(false)
  const [w, setW] = useState(360)
  const [nonce, setNonce] = useState(0)
  const devW = device === 'mobile' ? 390 : 1280
  const scale = Math.min(1, w / devW)

  useLayoutEffect(() => {
    if (!box.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const on = e => { if (e.origin === location.origin && e.data?.type === 'cs:preview-ready' && e.source === frame.current?.contentWindow) setReady(true) }
    addEventListener('message', on)
    return () => removeEventListener('message', on)
  }, [])

  useEffect(() => {
    if (!ready) return
    frame.current?.contentWindow?.postMessage({ type: 'cs:preview', settings, patch, theme }, location.origin)
  }, [ready, settings, patch, theme])

  return (
    <div className="ppreview">
      <div className="ppreview__bar">
        <div className="pseg" role="group" aria-label="Dispositivo">
          <button aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone size={15} /> Celular</button>
          <button aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor size={15} /> Escritorio</button>
        </div>
        <div className="pseg" role="group" aria-label="Tema de la vista previa">
          <button aria-pressed={theme !== 'dark'} onClick={() => setTheme('light')} aria-label="Claro"><Sun size={15} /></button>
          <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')} aria-label="Oscuro"><Moon size={15} /></button>
        </div>
        <button className="key key--icon key--sm" onClick={() => { setReady(false); setNonce(n => n + 1) }} aria-label="Recargar vista previa"><RotateCw size={15} /></button>
      </div>
      <div className="ppreview__box" ref={box} style={{ height }}>
        <div className={`ppreview__dev is-${device}`} style={{ width: devW, height: height / scale, transform: `scale(${scale})` }}>
          <iframe key={nonce} ref={frame} title="Vista previa del catálogo" src={`/c/${slug}?preview=1`} onLoad={() => {}} />
        </div>
        {!ready && <div className="ppreview__loading">Cargando vista previa…</div>}
      </div>
      <p className="pf__hint">Así se ve tu catálogo con los cambios. Se publican cuando presionas <b>Guardar</b>.</p>
    </div>
  )
}
