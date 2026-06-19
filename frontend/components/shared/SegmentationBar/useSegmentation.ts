'use client'

import { useCallback, useMemo } from 'react'
import { useQueryStates, useQueryState, parseAsString } from 'nuqs'
import type { SegmentationDefinition, SegmentDef } from '@/types/segmentation'
import type { UseSegmentationReturn } from './types'

function getSegmentParams(segment: SegmentDef): string[] {
  if (segment.type === 'tabs') return [segment.serverParam]
  if (segment.type === 'period') {
    const params: string[] = []
    if (segment.serverParamFrom) params.push(segment.serverParamFrom)
    if (segment.serverParamTo) params.push(segment.serverParamTo)
    return params
  }
  const params: string[] = []
  if (segment.serverParamDate) params.push(segment.serverParamDate)
  if (segment.serverParamFrom) params.push(segment.serverParamFrom)
  if (segment.serverParamTo) params.push(segment.serverParamTo)
  return params
}

export function useSegmentation(def: SegmentationDefinition): UseSegmentationReturn {
  const parsers = useMemo(() => {
    const map: Record<string, any> = {}
    for (const segment of def.segments) {
      for (const param of getSegmentParams(segment)) {
        map[param] = parseAsString
      }
    }
    return map
  }, [def])

  const [paramValues, setParamValues] = useQueryStates(parsers)
  const [, setCursor] = useQueryState('cursor', parseAsString)

  const filters: Record<string, string> = useMemo(
    () => Object.fromEntries(
      Object.entries(paramValues).filter(([, v]) => v !== null)
    ) as Record<string, string>,
    [paramValues],
  )

  const isFiltered = Object.keys(filters).length > 0

  const apply = useCallback(
    async (serverParam: string, value: string) => {
      await setCursor(null)
      await setParamValues({ [serverParam]: value })
    },
    [setCursor, setParamValues],
  )

  const remove = useCallback(
    async (serverParam: string) => {
      await setCursor(null)
      await setParamValues({ [serverParam]: null })
    },
    [setCursor, setParamValues],
  )

  const clearAll = useCallback(async () => {
    await setCursor(null)
    const nulled = Object.fromEntries(
      Object.keys(parsers).map((k) => [k, null]),
    )
    await setParamValues(nulled)
  }, [setCursor, parsers, setParamValues])

  return { filters, isFiltered, apply, remove, clearAll, def }
}
