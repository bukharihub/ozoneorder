import { createClient } from '@supabase/supabase-js'
import { friendlyErrorMessage } from './format'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const url = rawUrl.trim().replace(/\/+$/, '')
const key = rawKey.trim()

let validUrl = false
try {
  const parsed = new URL(url)
  validUrl = parsed.protocol === 'https:' || parsed.protocol === 'http:'
} catch {
  validUrl = false
}

export const isConfigured = Boolean(validUrl && key)

const ensureConfigured = () => {
  if (!isConfigured) throw new Error(friendlyErrorMessage(new Error('Server configuration is incomplete')))
}

const fetchWithSession: typeof fetch = async (input, init) => {
  ensureConfigured()
  const headers = new Headers(init?.headers || {})
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('ozone_session_token')
    if (token) headers.set('x-ozone-session', token)
  }
  headers.set('Cache-Control', 'no-cache')
  try {
    return await globalThis.fetch(input as RequestInfo, { ...init, headers })
  } catch (caught) {
    throw new Error(friendlyErrorMessage(caught))
  }
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
