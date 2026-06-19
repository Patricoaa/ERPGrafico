'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQueryState, useQueryStates, parseAsString } from 'nuqs'
import type { SearchDefinition, ActiveChip, FieldDef } from '@/types/search'
import type { FilterState } from './types'

const PRESERVED_PARAMS = new Set(['selected'])

function hasServerParam(field: FieldDef): field is Extract<FieldDef, { serverParam: string }> {
  return 'serverParam' in field
}

function getServerParams(field: FieldDef): string[] {
  if (hasServerParam(field)) return [field.serverParam]
  return []
}

function getFieldLabelForParam(def: SearchDefinition, param: string): string {
  for (const field of def.fields) {
    if (hasServerParam(field) && field.serverParam === param) return field.label
  }
  if (param === 'search') return 'Búsqueda'
  return param
}

function getValueLabel(def: SearchDefinition, param: string, value: string): string {
  for (const field of def.fields) {
    if (field.type === 'identity-enum' && field.serverParam === param) {
      return field.options.find((o) => o.value === value)?.label ?? value
    }
  }
  return value
}

function getDefaultValue(field: FieldDef): string | undefined {
  return undefined
}

export function useSmartSearch(def: SearchDefinition) {
  const [inputValue, setInputValue] = useState('')
  const [dismissedDefaults, setDismissedDefaults] = useState<Set<string>>(new Set())

  const defaults = useMemo(() => {
    const map: Record<string, string> = {}
    return map
  }, [def])

  const parsers = useMemo(() => {
    const map: Record<string, any> = {}
    for (const field of def.fields) {
      for (const param of getServerParams(field)) {
        map[param] = parseAsString
      }
    }
    map['search'] = parseAsString
    return map
  }, [def])

  const [paramValues, setParamValues] = useQueryStates(parsers)
  const [, setCursor] = useQueryState('cursor', parseAsString)

  const filters: FilterState = useMemo(
    () => Object.fromEntries(
      Object.entries(paramValues)
        .filter(([, v]) => v !== null)
        .filter(([param]) => !dismissedDefaults.has(param))
    ) as FilterState,
    [paramValues, dismissedDefaults],
  )

  const chips: ActiveChip[] = useMemo(
    () =>
      Object.entries(paramValues)
        .filter(([, v]) => v !== null)
        .filter(([param]) => !dismissedDefaults.has(param))
        .map(([param, value]) => ({
          key: param,
          label: getFieldLabelForParam(def, param),
          valueLabel: getValueLabel(def, param, value!),
          isGlobalSearch: param === 'search',
        })),
    [paramValues, def, dismissedDefaults],
  )

  const applyFilter = useCallback(
    async (param: string, value: string) => {
      await setCursor(null)
      setDismissedDefaults(prev => {
        const next = new Set(prev)
        next.delete(param)
        return next
      })
      await setParamValues({ [param]: value })
    },
    [setCursor, setParamValues],
  )

  const removeFilter = useCallback(
    async (param: string) => {
      if (PRESERVED_PARAMS.has(param)) return
      await setCursor(null)
      if (param in defaults) {
        setDismissedDefaults(prev => new Set(prev).add(param))
        await setParamValues({ [param]: defaults[param] })
      } else {
        await setParamValues({ [param]: null })
      }
    },
    [setCursor, setParamValues, defaults],
  )

  const clearAll = useCallback(async () => {
    await setCursor(null)
    const newDismissed = Object.keys(paramValues)
      .filter(k => !PRESERVED_PARAMS.has(k) && k in defaults)
    if (newDismissed.length > 0) {
      setDismissedDefaults(prev => new Set([...prev, ...newDismissed]))
    }
    const nulled = Object.fromEntries(
      Object.keys(paramValues)
        .filter((k) => !PRESERVED_PARAMS.has(k))
        .map((k) => [k, k in defaults ? defaults[k] : null]),
    )
    await setParamValues(nulled)
  }, [paramValues, setCursor, setParamValues, defaults])

  const isFiltered = chips.length > 0

  return {
    filters,
    chips,
    isFiltered,
    inputValue,
    setInputValue,
    applyFilter,
    removeFilter,
    clearAll,
  }
}
