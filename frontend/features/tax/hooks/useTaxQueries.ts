import { useQuery, useQueryClient } from '@tanstack/react-query'
import { taxApi } from '../api/taxApi'
import { TAX_KEYS } from './queryKeys'
import type { TaxDeclaration } from '../types'

export function useTaxPeriods() {
  const { data: taxPeriods, isLoading, isError, refetch } = useQuery({
    queryKey: TAX_KEYS.periods.lists(),
    queryFn: () => taxApi.getPeriods(),
    staleTime: 5 * 60 * 1000,
  })
  return { taxPeriods: taxPeriods ?? null, isLoading, isError, refetch }
}

export function useTaxPeriod(id: number | string | undefined) {
  const { data: taxPeriod, isLoading, isError } = useQuery({
    queryKey: TAX_KEYS.periods.detail(Number(id)),
    queryFn: () => taxApi.getPeriod(id as number | string),
    staleTime: 2 * 60 * 1000,
    enabled: !!id,
  })
  return { taxPeriod: taxPeriod ?? null, isLoading, isError }
}

export function useTaxDeclarations(params: Record<string, unknown>) {
  const { data: taxDeclarations, isLoading, isError } = useQuery({
    queryKey: TAX_KEYS.declarations.list(params),
    queryFn: () => taxApi.getDeclarations(params),
    enabled: Object.keys(params).length > 0,
    staleTime: 2 * 60 * 1000,
  })
  return { taxDeclarations: taxDeclarations ?? null, isLoading, isError }
}

export function useF29Detail(id: number | string | undefined) {
  const { data: f29Detail, isLoading, isError } = useQuery({
    queryKey: TAX_KEYS.f29.detail(Number(id)),
    queryFn: () => taxApi.getF29Detail(id as number | string),
    staleTime: 2 * 60 * 1000,
    enabled: !!id,
  })
  return { f29Detail: f29Detail ?? null, isLoading, isError }
}

export function useLazyTaxDeclarations() {
  const queryClient = useQueryClient()

  const fetchDeclarations = async (params: Record<string, unknown>): Promise<TaxDeclaration[]> => {
    const pageData = await queryClient.fetchQuery({
      queryKey: TAX_KEYS.declarations.list(params),
      queryFn: () => taxApi.getDeclarations(params),
    })
    return (pageData?.results ?? []) as TaxDeclaration[]
  }

  return { fetchDeclarations }
}
