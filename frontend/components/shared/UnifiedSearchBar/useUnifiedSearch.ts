'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQueryState, useQueryStates, parseAsString } from 'nuqs'
import type {
  UnifiedSearchConfig,
  UnifiedChip,
  UseUnifiedSearchReturn,
  ToggleFilterDef,
  RangeFilterDef,
  MultiSelectFilterDef,
  SingleSelectFilterDef,
} from '@/types/unified-search'

const PRESERVED_PARAMS = new Set(['selected'])

type FlatParamDef = {
  param: string
  source: 'search' | 'searchField' | 'toggle' | 'multi' | 'single' | 'rangeFrom' | 'rangeTo' | 'dateFrom' | 'dateTo' | 'basePeriodFrom' | 'basePeriodTo'
  label: string
}

function collectParamDefs(config: UnifiedSearchConfig): FlatParamDef[] {
  const defs: FlatParamDef[] = []

  defs.push({ param: 'search', source: 'search', label: 'Búsqueda' })

  for (const field of config.searchFields) {
    if (field.serverParam) {
      defs.push({ param: field.serverParam, source: 'searchField', label: field.label })
    }
  }

  for (const filter of config.filters ?? []) {
    if (filter.type === 'toggle') {
      const f = filter as ToggleFilterDef
      defs.push({ param: f.serverParam, source: 'toggle', label: f.label })
    } else if (filter.type === 'multi') {
      const f = filter as MultiSelectFilterDef
      defs.push({ param: f.serverParam, source: 'multi', label: f.label })
    } else if (filter.type === 'single') {
      const f = filter as SingleSelectFilterDef
      defs.push({ param: f.serverParam, source: 'single', label: f.label })
    } else if (filter.type === 'range') {
      const f = filter as RangeFilterDef
      defs.push({ param: f.serverParamFrom, source: 'rangeFrom', label: `${f.label} (desde)` })
      defs.push({ param: f.serverParamTo, source: 'rangeTo', label: `${f.label} (hasta)` })
    }
  }

  for (const df of config.dateFilters ?? []) {
    const seenFrom = new Set<string>()
    const seenTo = new Set<string>()
    for (const opt of df.options) {
      if (opt.serverParamFrom && !seenFrom.has(opt.serverParamFrom)) {
        seenFrom.add(opt.serverParamFrom)
        defs.push({ param: opt.serverParamFrom, source: 'dateFrom', label: `${df.label} (desde)` })
      }
      if (opt.serverParamTo && !seenTo.has(opt.serverParamTo)) {
        seenTo.add(opt.serverParamTo)
        defs.push({ param: opt.serverParamTo, source: 'dateTo', label: `${df.label} (hasta)` })
      }
    }
  }

  if (config.basePeriod) {
    defs.push({ param: config.basePeriod.serverParamFrom, source: 'basePeriodFrom', label: 'Período (desde)' })
    defs.push({ param: config.basePeriod.serverParamTo, source: 'basePeriodTo', label: 'Período (hasta)' })
  }

  defs.push({ param: 'group_by', source: 'search', label: 'Agrupado por' })

  return defs
}

function getChipVariant(source: FlatParamDef['source']): UnifiedChip['variant'] {
  switch (source) {
    case 'search':
    case 'searchField':
      return 'filter'
    case 'toggle':
    case 'multi':
    case 'single':
      return 'filter'
    case 'rangeFrom':
    case 'rangeTo':
      return 'range'
    case 'dateFrom':
    case 'dateTo':
    case 'basePeriodFrom':
    case 'basePeriodTo':
      return 'date'
  }
}

export function useUnifiedSearch(config: UnifiedSearchConfig): UseUnifiedSearchReturn {
  const [inputValue, setInputValue] = useState('')

  const paramDefs = useMemo(() => collectParamDefs(config), [config])

  const parsers = useMemo(() => {
    const map: Record<string, typeof parseAsString> = {}
    for (const def of paramDefs) {
      map[def.param] = parseAsString
    }
    return map
  }, [paramDefs])

  const [paramValues, setParamValues] = useQueryStates(parsers)
  const [, setCursor] = useQueryState('cursor', parseAsString)

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
    const nulled: Record<string, string | null> = {}
    for (const def of paramDefs) {
      if (!PRESERVED_PARAMS.has(def.param)) {
        nulled[def.param] = null
      }
    }
    await setParamValues(nulled)
  }, [paramDefs, setCursor, setParamValues])

  const filters: Record<string, string> = useMemo(
    () => Object.fromEntries(
      Object.entries(paramValues).filter(([, v]) => v !== null)
    ) as Record<string, string>,
    [paramValues],
  )

  const chips: UnifiedChip[] = useMemo(
    () => {
      const result: UnifiedChip[] = []
      const currentParamValues = paramValues as Record<string, string | null>

      for (const [param, value] of Object.entries(currentParamValues)) {
        if (value === null) continue
        if (PRESERVED_PARAMS.has(param)) continue
        if (param === 'group_by') continue

        const paramDef = paramDefs.find(d => d.param === param)
        if (!paramDef) continue

        let valueLabel = value
        if (paramDef.source === 'single') {
          const filterDef = config.filters?.find(f => f.type === 'single' && f.serverParam === param) as SingleSelectFilterDef | undefined
          const opt = filterDef?.options.find(o => o.value === value)
          valueLabel = opt?.label ?? value
        } else if (paramDef.source === 'multi') {
          const parts = value.split(',').filter(Boolean)
          if (parts.length === 1) {
            const filterDef = config.filters?.find(f => f.type === 'multi' && f.serverParam === param) as MultiSelectFilterDef | undefined
            const opt = filterDef?.options.find(o => o.value === parts[0])
            valueLabel = opt?.label ?? parts[0]
          } else if (parts.length > 1) {
            valueLabel = `${parts.length} seleccionados`
          }
        }

        result.push({
          id: param,
          label: paramDef.label,
          valueLabel,
          variant: getChipVariant(paramDef.source),
          onRemove: () => { removeFilter(param) },
        })
      }

      // Add group_by chip when a group is selected
      const groupByVal = currentParamValues.group_by as string | undefined
      if (groupByVal && config.groupBy) {
        const opt = config.groupBy.find(g => g.key === groupByVal)
        if (opt) {
          result.push({
            id: 'group_by',
            label: 'Agrupado por',
            valueLabel: opt.label,
            variant: 'group',
            onRemove: () => { removeFilter('group_by') },
          })
        }
      }

      return result
    },
    [paramValues, paramDefs, removeFilter, config.filters, config.groupBy],
  )

  const isFiltered = chips.length > 0

  const groupBy = useMemo(
    () => (paramValues.group_by as string) ?? null,
    [paramValues.group_by],
  )

  const setGroupBy = useCallback(
    async (key: string | null) => {
      await setCursor(null)
      await setParamValues({ group_by: key })
    },
    [setCursor, setParamValues],
  )

  const filterFn = useCallback(
    <T>(data: T[]): T[] => {
      if (Object.keys(filters).length === 0) return data

      return data.filter((row) => {
        const r = row as Record<string, unknown>
        if (filters.search) {
          const searchVal = filters.search.toLowerCase()
          const matchesGlobal = Object.values(r).some((val) =>
            String(val ?? '').toLowerCase().includes(searchVal)
          )
          if (!matchesGlobal) return false
        }

        for (const field of config.searchFields) {
          if (field.serverParam === 'search') continue
          const filterVal = filters[field.serverParam]
          if (!filterVal) continue

          const clientKeys = field.clientKey
            ? (Array.isArray(field.clientKey) ? field.clientKey : [field.clientKey])
            : [field.key]

          const matches = clientKeys.some((k) =>
            String(r[k] ?? '').toLowerCase().includes(filterVal.toLowerCase())
          )
          if (!matches) return false
        }

        return true
      })
    },
    [filters, config.searchFields],
  )

  return {
    filters,
    paramValues: paramValues as Record<string, string | null>,
    chips,
    isFiltered,
    groupBy,
    setGroupBy,
    applyFilter,
    removeFilter,
    clearAll,
    inputValue,
    setInputValue,
    filterFn,
  }
}
