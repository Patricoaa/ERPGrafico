"use client"

import { useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { MappingType } from '@/features/finance/hooks/useAccountMappings'

const VALID_TYPES = new Set<MappingType>(['is', 'cf', 'bs'])

function isValidMapping(v: string | null): v is MappingType {
  return v !== null && VALID_TYPES.has(v as MappingType)
}

export function useMappingDrawer(defaultType: MappingType) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const mappingParam = searchParams.get('mapping')
  const open = isValidMapping(mappingParam)
  const resolvedMappingType: MappingType = isValidMapping(mappingParam) ? mappingParam : defaultType

  const openDrawer = useCallback((type?: MappingType) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('mapping', type ?? defaultType)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }, [router, pathname, searchParams, defaultType])

  const onOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('mapping')
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }
  }, [router, pathname, searchParams])

  return { open, onOpenChange, resolvedMappingType, openDrawer }
}
