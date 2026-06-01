import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCreditPortfolio, getBlacklistedPortfolio, getGlobalCreditHistory } from '../api/creditsApi'

const CREDITS_KEY = ['credits'] as const

export function useCreditPortfolio() {
    const queryClient = useQueryClient()

    const query = useQuery({
        queryKey: [...CREDITS_KEY, 'portfolio'],
        queryFn: getCreditPortfolio,
        staleTime: 2 * 60 * 1000,
    })

    const refetch = () => queryClient.invalidateQueries({ queryKey: [...CREDITS_KEY, 'portfolio'] })

    return {
        data: query.data ?? null,
        contacts: query.data?.contacts ?? [],
        summary: query.data?.summary ?? null,
        isLoading: query.isLoading,
        refetch,
    }
}

export function useBlacklistedPortfolio() {
    const queryClient = useQueryClient()

    const query = useQuery({
        queryKey: [...CREDITS_KEY, 'blacklist'],
        queryFn: getBlacklistedPortfolio,
        staleTime: 2 * 60 * 1000,
    })

    const refetch = () => queryClient.invalidateQueries({ queryKey: [...CREDITS_KEY, 'blacklist'] })

    return {
        contacts: query.data?.contacts ?? [],
        isLoading: query.isLoading,
        refetch,
    }
}

export function useCreditHistory() {
    return useQuery({
        queryKey: [...CREDITS_KEY, 'history'],
        queryFn: getGlobalCreditHistory,
        staleTime: 2 * 60 * 1000,
    })
}
