const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hasSupabase = Boolean(url && key && !url.includes('TU-PROYECTO'))

// La librería se carga solo cuando hace falta (el catálogo pinta antes)
let client = null
export async function getSupabase() {
  if (!hasSupabase) return null
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js')
    client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  }
  return client
}
