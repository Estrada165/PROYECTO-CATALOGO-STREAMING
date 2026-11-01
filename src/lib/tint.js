// Color dominante de un logo (para teñir la tarjeta). Se calcula una vez por imagen.
const cache = new Map()
export function logoTint(url) {
  if (!url) return Promise.resolve(null)
  if (cache.has(url)) return cache.get(url)
  const p = new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 20
        const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 20, 20)
        const d = x.getImageData(0, 0, 20, 20).data
        let r = 0, g = 0, b = 0, n = 0
        for (let i = 0; i < d.length; i += 4) {
          const R = d[i], G = d[i + 1], B = d[i + 2], A = d[i + 3]
          const max = Math.max(R, G, B), min = Math.min(R, G, B)
          if (A < 200 || max - min < 40 || max < 50) continue // ignora transparente, gris y negro
          r += R; g += G; b += B; n++
        }
        resolve(n > 8 ? `rgb(${Math.round(r / n)} ${Math.round(g / n)} ${Math.round(b / n)})` : null)
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
  cache.set(url, p)
  return p
}
