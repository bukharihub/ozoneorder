import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const isConfigured = Boolean(url && key)

const fetchWithSession: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers || {})
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('ozone_session_token')
    if (token) headers.set('x-ozone-session', token)
  }
  headers.set('Cache-Control', 'no-cache')
  return globalThis.fetch(input as RequestInfo, { ...init, headers })
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-anon-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'Cache-Control': 'no-cache' },
      fetch: fetchWithSession,
    },
  },
)
