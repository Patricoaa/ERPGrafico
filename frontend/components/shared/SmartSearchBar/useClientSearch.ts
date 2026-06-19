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

        if (filters.search) {
          const searchVal = filters.search.toLowerCase()
          const matchesGlobal = Object.values(r).some((val) =>
            String(val ?? '').toLowerCase().includes(searchVal)
          )
          if (!matchesGlobal) return false
        }

        return searchDef.fields.every((field) => {
          if (field.serverParam === 'search') return true

          const filterVal = filters[field.serverParam]
          if (!filterVal) return true

          if (field.type === 'identity-enum') {
            return String(r[field.key] ?? '') === filterVal
          }

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
