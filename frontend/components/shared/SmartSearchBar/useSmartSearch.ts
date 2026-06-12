'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQueryState, useQueryStates, parseAsString } from 'nuqs'
import type { SearchDefinition, ActiveChip, FieldDef } from '@/types/search'
import type { FilterState } from './types'

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
  if (param === 'search') return 'Búsqueda'
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

function getDefaultValue(field: FieldDef): string | undefined {
  if (field.type === 'enum') return field.defaultValue
  return undefined
}

export function useSmartSearch(def: SearchDefinition) {
  const [inputValue, setInputValue] = useState('')
  // Tracks which defaults the user has explicitly dismissed (chip hidden but value still active)
  const [dismissedDefaults, setDismissedDefaults] = useState<Set<string>>(new Set())

  // Build defaults map from SearchDefinition
  const defaults = useMemo(() => {
    const map: Record<string, string> = {}
    for (const field of def.fields) {
      const dv = getDefaultValue(field)
      if (dv !== undefined) {
        for (const param of getServerParams(field)) {
          map[param] = dv
        }
      }
    }
    return map
  }, [def])

  // Build parsers map with withDefault for fields that have defaults
  const parsers = useMemo(() => {
    const map: Record<string, any> = {}
    for (const field of def.fields) {
      for (const param of getServerParams(field)) {
        const dv = getDefaultValue(field)
        map[param] = dv !== undefined ? parseAsString.withDefault(dv) : parseAsString
      }
    }
    // Always include 'search' as a recognized parameter for global search
    map['search'] = parseAsString
    return map
  }, [def])

  const [paramValues, setParamValues] = useQueryStates(parsers)
  const [, setCursor] = useQueryState('cursor', parseAsString)

  // Filters include ALL non-null values (even defaults) so the API always receives them
  const filters: FilterState = useMemo(
    () => Object.fromEntries(
      Object.entries(paramValues)
        .filter(([, v]) => v !== null)
        .filter(([param]) => !dismissedDefaults.has(param))
    ) as FilterState,
    [paramValues, dismissedDefaults],
  )

  // Chips: show all non-null values except dismissed defaults
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
      // Re-adding a param explicitly removes it from dismissed state
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
        // Dismiss the default so the chip disappears (value stays active for the API)
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
    // Dismiss all params that have defaults
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

  // Single source of truth for "the toolbar search/filter is active".
  // Consumers pass this to DataTable to distinguish "no records at all"
  // from "no results for the current search/filter".
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
