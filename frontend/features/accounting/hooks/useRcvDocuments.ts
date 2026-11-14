import { useQuery } from '@tanstack/react-query'
import { staleTime } from '@/lib/query-config'
import { rcvApi } from '../api/rcvApi'
import { RCV_KEYS } from './queryKeys'
import type { RcvDocumentFilters } from '../types'

function cleanParams<T extends object>(filters: T): T {
    return Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ) as T
}

export function useRcvDocuments(filters: RcvDocumentFilters = {}) {
    const { page = 1, page_size = 50, ...rest } = filters
    const params: RcvDocumentFilters = { ...cleanParams(rest), page, page_size }

    const { data, isLoading, isFetching, isError, refetch } = useQuery({
        queryKey: [...RCV_KEYS.documents(), 'list', params],
        queryFn: ({ signal }) => rcvApi.getDocuments(params, signal),
        staleTime: staleTime.standard,
    })

    return {
        page: data,
        documents: data?.results ?? [],
        totalCount: data?.count ?? 0,
        isLoading,
        isRefetching: isFetching && !isLoading,
        isError,
        refetch,
    }
}

export function useRcvDocument(id: number | null | undefined) {
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: RCV_KEYS.document(id ?? 0),
        queryFn: () => rcvApi.getDocument(id as number),
        enabled: id != null,
        staleTime: staleTime.standard,
    })

    return { document: data, isLoading, isError, refetch }
}
