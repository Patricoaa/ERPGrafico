import { useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import { TERMINAL_SALES_KEYS } from './queryKeys'
import type { TerminalSaleFilters, TerminalSalesSummaryFilters } from '../types'
import { staleTime } from '@/lib/query-config'

function cleanParams<T extends object>(filters: T): T {
    return Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ) as T
}

export function useTerminalSales(filters: TerminalSaleFilters = {}) {
    const { page = 1, page_size = 50, ...rest } = filters
    const params: TerminalSaleFilters = { ...cleanParams(rest), page, page_size }

    const { data, isLoading, isFetching, isError, refetch } = useQuery({
        queryKey: [...TERMINAL_SALES_KEYS.lists(), params],
        queryFn: ({ signal }) => treasuryApi.getTerminalSales(params, signal),
        staleTime: staleTime.standard,
    })

    return {
        page: data,
        sales: data?.results ?? [],
        totalCount: data?.count ?? 0,
        isLoading,
        isRefetching: isFetching && !isLoading,
        isError,
        refetch,
    }
}

export function useTerminalSalesSummary(filters: TerminalSalesSummaryFilters = {}) {
    const params = cleanParams(filters)
    const { data, isLoading, isFetching, isError, refetch } = useQuery({
        queryKey: [...TERMINAL_SALES_KEYS.summaries(), params],
        queryFn: () => treasuryApi.getTerminalSalesSummary(params),
        staleTime: staleTime.standard,
    })

    return { summary: data, isLoading, isRefetching: isFetching && !isLoading, isError, refetch }
}

export function useTerminalSale(id: number | null | undefined) {
    const { data, isLoading, isError } = useQuery({
        queryKey: TERMINAL_SALES_KEYS.detail(id ?? 0),
        queryFn: () => treasuryApi.getTerminalSale(id as number),
        enabled: typeof id === 'number',
        staleTime: staleTime.standard,
    })

    return { sale: data, isLoading, isError }
}
