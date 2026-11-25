'use client'

import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from './format'

export function useRows<T>(loader: () => Promise<T[]>, deps: any[]) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRows(await loader())
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    void reload()
  }, [reload])

  return { rows, setRows, loading, error, reload }
}
