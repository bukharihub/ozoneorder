import type { AppSession } from './types'

const SESSION_KEY = 'ozone_erp_session'

export const getSession = (): AppSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.user?.id || !parsed?.company?.company_id) return null
    return parsed as AppSession
  } catch {
    return null
  }
}

export const saveSession = (session: AppSession): void => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export const clearSession = (): void => {
  localStorage.removeItem(SESSION_KEY)
}
