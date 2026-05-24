import { useQuery, useQueryClient } from '@tanstack/react-query'
import { taxApi } from '../api/taxApi'
import { TAX_KEYS } from './queryKeys'
import type { TaxDeclaration } from '../types'

export function useTaxPeriods() {
  return useQuery({
    queryKey: TAX_KEYS.periods.lists(),
    queryFn: () => taxApi.getPeriods(),
    staleTime: 5 * 60 * 1000,
  })
}

export function useTaxPeriod(id: number | string | undefined) {
  return useQuery({
    queryKey: TAX_KEYS.periods.detail(Number(id)),
    queryFn: () => taxApi.getPeriod(id!),
    enabled: !!id,
  })
}

export function useTaxDeclarations(params: Record<string, unknown>) {
  return useQuery({
    queryKey: TAX_KEYS.declarations.list(params),
    queryFn: () => taxApi.getDeclarations(params),
    enabled: Object.keys(params).length > 0,
    staleTime: 2 * 60 * 1000,
  })
}

export function useF29Detail(id: number | string | undefined) {
  return useQuery({
    queryKey: TAX_KEYS.f29.detail(Number(id)),
    queryFn: () => taxApi.getF29Detail(id!),
    enabled: !!id,
  })
}

export function useLazyTaxDeclarations() {
  const queryClient = useQueryClient()

  const fetchDeclarations = async (params: Record<string, unknown>): Promise<TaxDeclaration[]> => {
    const data = await queryClient.fetchQuery({
      queryKey: TAX_KEYS.declarations.list(params),
      queryFn: () => taxApi.getDeclarations(params),
    })
    return Array.isArray(data) ? data : ((data as { results?: TaxDeclaration[] })?.results ?? [])
  }

  return { fetchDeclarations }
}
