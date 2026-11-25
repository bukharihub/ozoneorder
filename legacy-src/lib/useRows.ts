import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../components/AppContext'
import { listRows, type ListOptions } from './api'
import type { Row } from './types'

export const useRows = <T extends Row = Row>(table: string, options: ListOptions = {}) => {
  const { refreshKey } = useApp()
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const optionsKey = JSON.stringify(options)

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listRows<T>(table, JSON.parse(optionsKey) as ListOptions)
      setRows(data)
    } catch (cause: any) {
      setError(cause?.message || `Unable to load ${table}`)
    } finally {
      setLoading(false)
    }
  }, [table, optionsKey])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  return { rows, setRows, loading, error, reload }
}
