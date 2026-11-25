import { createContext, useContext } from 'react'
import type { AppSession, Permissions, ToastMessage } from '../lib/types'

export interface AppContextValue {
  session: AppSession
  permissions: Permissions
  refreshKey: number
  refresh: () => void
  notify: (text: string, tone?: ToastMessage['tone']) => void
  logout: () => Promise<void>
}

export const AppContext = createContext<AppContextValue | null>(null)

export const useApp = (): AppContextValue => {
  const value = useContext(AppContext)
  if (!value) throw new Error('App context is unavailable')
  return value
}
