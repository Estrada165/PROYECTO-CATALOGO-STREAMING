export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    try { navigator.vibrate?.(10) } catch { /* sin vibración */ }
    return true
  } catch {
    // Respaldo para navegadores sin permiso de portapapeles
    const ta = document.createElement('textarea')
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    ta.remove()
    return ok
  }
}
