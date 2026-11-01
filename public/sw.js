// Service worker del panel (C-Stream). Hace la app instalable y abre más rápido.
// Nunca guarda datos de Supabase: solo la página y los archivos de diseño.
const CACHE = 'cstream-v1'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k)
  await self.clients.claim()
})()))
self.addEventListener('fetch', e => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin) return   // Supabase y otros: directo a la red
  // Páginas: primero la red (siempre lo más nuevo); sin conexión, la última versión guardada
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put('/index.html', c)); return r })
      .catch(() => caches.match('/index.html')))
    return
  }
  // Archivos con huella (/assets/…) y logos: de la caché si ya están
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/library/') || url.pathname.startsWith('/app/')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)) }
      return r
    })))
  }
})
