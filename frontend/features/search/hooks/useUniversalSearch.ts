import { useQuery } from '@tanstack/react-query'
import { searchApi, type SearchResult } from '../api/searchApi'
import { staleTime } from '@/lib/query-config'

const SEARCH_KEYS = {
    results: (q: string) => ['universal-search', q] as const,
}

export function useUniversalSearch(query: string): {
    results: SearchResult[]
    isLoading: boolean
} {
    const enabled = query.trim().length >= 2

    const { data, isFetching } = useQuery({
        queryKey: SEARCH_KEYS.results(query),
        queryFn: () => searchApi.search(query),
        enabled,
        staleTime: staleTime.volatile,
        placeholderData: (prev) => prev,
    })

    return {
        results: data ?? [],
        isLoading: isFetching && enabled,
    }
}
