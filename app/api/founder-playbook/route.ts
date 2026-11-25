import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { FOUNDER_PLAYBOOK } from '@/lib/server/founderPlaybook'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const token = request.headers.get('x-ozone-session')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json({ error: 'Backend not configured' }, { status: 503 })

  const fetchWithToken: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers || {})
    headers.set('x-ozone-session', token)
    headers.set('Cache-Control', 'no-cache')
    return globalThis.fetch(input as RequestInfo, { ...init, headers, cache: 'no-store' })
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchWithToken },
  })

  const { data, error } = await supabase.rpc('is_super_admin')
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  if (data !== true) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json(FOUNDER_PLAYBOOK, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
