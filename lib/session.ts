import type { Session } from './types'

const SESSION_KEY = 'ozone_session'
const TOKEN_KEY = 'ozone_session_token'

export const getSession = (): Session | null => {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export const saveSession = (session: Session) => {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  window.localStorage.setItem(TOKEN_KEY, session.token)
}

export const clearSession = () => {
  window.localStorage.removeItem(SESSION_KEY)
  window.localStorage.removeItem(TOKEN_KEY)
}
