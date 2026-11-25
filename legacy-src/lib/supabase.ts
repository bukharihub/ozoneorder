import { createClient } from '@supabase/supabase-js'
import { getSession } from './session'

const clean = (value: any): string => String(value || '').trim()

export const supabaseUrl = clean(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, '')
export const supabaseAnonKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)
export const isConfigured = Boolean(supabaseUrl && supabaseAnonKey)

const requestWithTenantHeaders: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers || {})
  const session = getSession()
  if (session?.company?.company_id) headers.set('x-ozone-company-id', session.company.company_id)
  if (session?.user?.id) headers.set('x-ozone-user-id', session.user.id)
  headers.set('Cache-Control', 'no-cache')
  return globalThis.fetch(input as RequestInfo, { ...init, headers })
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'Cache-Control': 'no-cache' },
      fetch: requestWithTenantHeaders,
    },
  },
)
