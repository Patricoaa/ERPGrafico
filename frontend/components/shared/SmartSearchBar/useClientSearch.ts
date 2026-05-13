'use client'

import { useCallback } from 'react'
import { useSmartSearch } from './useSmartSearch'
import type { SearchDefinition, FieldDef } from '@/types/search'

function resolveClientKeys(field: FieldDef): string[] {
  if (field.type === 'text') {
    if (field.clientKey) {
      return Array.isArray(field.clientKey) ? field.clientKey : [field.clientKey]
    }
    return [field.key]
  }
  return [field.key]
}

/**
 * Drop-in companion to useSmartSearch for routes where server-side filtering is
 * disproportionate (small / static datasets). Reuses all nuqs URL-sync logic
 * from useSmartSearch — chips, deeplinks, and ?selected= preservation work
 * identically. The only difference is filtering happens client-side via filterFn.
 *
 * Migration to server-side: swap useClientSearch → useSmartSearch, pass filters
 * to the hook, add FilterSet on the backend. The view and SmartSearchBar are unchanged.
 */
export function useClientSearch<T extends object>(
  searchDef: SearchDefinition,
) {
  const smartSearch = useSmartSearch(searchDef)
  const { filters } = smartSearch

  const filterFn = useCallback(
    (data: T[]): T[] => {
      if (Object.keys(filters).length === 0) return data

      return data.filter((row) => {
        const r = row as Record<string, unknown>
        return searchDef.fields.every((field) => {
          if (field.type === 'daterange') {
            const start = filters[field.serverParamStart]
            const end = filters[field.serverParamEnd]
            if (!start && !end) return true
            const rawVal = r[field.key]
            if (rawVal === undefined || rawVal === null) return false
            const date = new Date(String(rawVal))
            if (start && date < new Date(start)) return false
            if (end && date > new Date(end)) return false
            return true
          }

          const filterVal = filters[field.serverParam]
          if (!filterVal) return true

          if (field.type === 'enum') {
            return String(r[field.key] ?? '') === filterVal
          }

          // text — clientKey supports multi-field matching (e.g. name + code)
          const keys = resolveClientKeys(field)
          return keys.some((k) =>
            String(r[k] ?? '').toLowerCase().includes(filterVal.toLowerCase()),
          )
        })
      })
    },
    [filters, searchDef.fields],
  )

  return { ...smartSearch, filterFn }
}
