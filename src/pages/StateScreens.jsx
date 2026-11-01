export function StateScreen({ logo, title, text, action, retry }) {
  return (
    <main className="state">
      <div className="state__card">
        {logo && <img src={logo} alt="" width="80" height="80" />}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
        {action}
        {retry && <button className="key key--lg" onClick={() => location.reload()}>Reintentar</button>}
      </div>
    </main>
  )
}

export function LoadingScreen() {
  return (
    <main className="wrap" aria-busy="true" aria-label="Cargando catálogo" style={{ paddingTop: 88 }}>
      <div className="skel" style={{ width: 64, height: 64, borderRadius: 19 }} />
      <div className="skel" style={{ width: 'min(520px, 80%)', height: 64, marginTop: 20 }} />
      <div className="skel" style={{ width: 'min(360px, 60%)', height: 20, marginTop: 14 }} />
      <div className="grid" style={{ marginTop: 40 }}>
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="skel" style={{ height: 230 }} />)}
      </div>
    </main>
  )
}
