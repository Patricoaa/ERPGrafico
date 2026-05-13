'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQueryState, useQueryStates, parseAsString } from 'nuqs'
import type { SearchDefinition, ActiveChip, FieldDef } from '@/types/search'
import type { FilterState } from './parseTokens'

// Params that must never be cleared by SmartSearchBar — owned by other hooks
const PRESERVED_PARAMS = new Set(['selected'])

function getServerParams(field: FieldDef): string[] {
  if (field.type === 'daterange') return [field.serverParamStart, field.serverParamEnd]
  return [field.serverParam]
}

function getFieldLabelForParam(def: SearchDefinition, param: string): string {
  for (const field of def.fields) {
    if (field.type === 'daterange') {
      if (param === field.serverParamStart) return `${field.label} desde`
      if (param === field.serverParamEnd) return `${field.label} hasta`
    } else {
      if (field.serverParam === param) return field.label
    }
  }
  return param
}

function getValueLabel(def: SearchDefinition, param: string, value: string): string {
  for (const field of def.fields) {
    if (field.type === 'enum' && field.serverParam === param) {
      return field.options.find((o) => o.value === value)?.label ?? value
    }
  }
  return value
}

export function useSmartSearch(def: SearchDefinition) {
  const [inputValue, setInputValue] = useState('')

  // Build the parsers map from SearchDefinition (stable — def is a module-level constant)
  const parsers = useMemo(() => {
    const map: Record<string, typeof parseAsString> = {}
    for (const field of def.fields) {
      for (const param of getServerParams(field)) {
        map[param] = parseAsString
      }
    }
    return map
  }, [def])

  const [paramValues, setParamValues] = useQueryStates(parsers)
  const [, setCursor] = useQueryState('cursor', parseAsString)

  const filters: FilterState = useMemo(
    () => Object.fromEntries(Object.entries(paramValues).filter(([, v]) => v !== null)) as FilterState,
    [paramValues],
  )

  const chips: ActiveChip[] = useMemo(
    () =>
      Object.entries(paramValues)
        .filter(([, v]) => v !== null)
        .map(([param, value]) => ({
          key: param,
          label: getFieldLabelForParam(def, param),
          valueLabel: getValueLabel(def, param, value!),
        })),
    [paramValues, def],
  )

  const applyFilter = useCallback(
    async (param: string, value: string) => {
      await setCursor(null)
      await setParamValues({ [param]: value })
    },
    [setCursor, setParamValues],
  )

  const removeFilter = useCallback(
    async (param: string) => {
      if (PRESERVED_PARAMS.has(param)) return
      await setCursor(null)
      await setParamValues({ [param]: null })
    },
    [setCursor, setParamValues],
  )

  const clearAll = useCallback(async () => {
    await setCursor(null)
    const nulled = Object.fromEntries(
      Object.keys(paramValues)
        .filter((k) => !PRESERVED_PARAMS.has(k))
        .map((k) => [k, null]),
    )
    await setParamValues(nulled)
  }, [paramValues, setCursor, setParamValues])

  return {
    filters,
    chips,
    inputValue,
    setInputValue,
    applyFilter,
    removeFilter,
    clearAll,
  }
}
