import { useEffect, useState } from 'react'

// El panel (no el catálogo del cliente) se puede instalar como app.
let deferred = null
const listeners = new Set()
if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; listeners.forEach(f => f(true)) })
  addEventListener('appinstalled', () => { deferred = null; listeners.forEach(f => f(false)) })
}

export function enablePwa() {
  const head = document.head
  if (!head.querySelector('link[rel="manifest"]')) {
    head.insertAdjacentHTML('beforeend', '<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/app/apple-180.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="C-Stream">')
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker?.register('/sw.js').catch(() => {})
  }
}

// Botón "Instalar app": solo aparece cuando el navegador lo permite
export function useInstall() {
  const [can, setCan] = useState(Boolean(deferred))
  useEffect(() => { listeners.add(setCan); return () => listeners.delete(setCan) }, [])
  const install = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; setCan(false) }
  return [can, install]
}
