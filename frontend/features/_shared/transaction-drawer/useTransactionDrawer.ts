'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import type { TransactionType } from './types'

interface UseTransactionDrawerReturn {
  open: boolean
  id: number | null
  entityType: TransactionType | null
  mode: 'view' | 'edit'
  openDrawer: (id: number, type?: TransactionType, mode?: 'view' | 'edit') => void
  closeDrawer: () => void
}

export function useTransactionDrawer(): UseTransactionDrawerReturn {
  const searchParams = useSearchParams()
  const router = useRouter()

  const id = useMemo(() => {
    const raw = searchParams.get('selected')
    return raw ? Number(raw) : null
  }, [searchParams])

  const mode = useMemo(() => {
    return (searchParams.get('mode') as 'view' | 'edit') || 'view'
  }, [searchParams])

  const entityType = useMemo(() => {
    const raw = searchParams.get('entityType') as TransactionType | null
    return raw || null
  }, [searchParams])

  const openDrawer = useCallback(
    (entityId: number, type?: TransactionType, drawerMode: 'view' | 'edit' = 'view') => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('selected', String(entityId))
      params.set('mode', drawerMode)
      if (type) params.set('entityType', type)
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  const closeDrawer = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('selected')
    params.delete('mode')
    params.delete('entityType')
    router.push(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  return {
    open: id !== null,
    id,
    entityType,
    mode,
    openDrawer,
    closeDrawer,
  }
}
