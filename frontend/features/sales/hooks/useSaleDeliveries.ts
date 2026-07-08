import { useQuery } from '@tanstack/react-query'
import { salesApi } from '../api/salesApi'
import { SALES_KEYS } from './queryKeys'

export function useSaleDeliveries(filters?: Record<string, unknown>) {
    const page = Number(filters?.page ?? 1)
    const pageSize = Number(filters?.page_size ?? 50)
    const query = useQuery({
        queryKey: SALES_KEYS.deliveries({ page, page_size: pageSize, ...filters }),
        queryFn: () => salesApi.getDeliveriesPaginated({ page, page_size: pageSize, ...filters }),
        staleTime: 2 * 60 * 1000,
    })

    return {
        page: query.data,
        deliveries: query.data?.results ?? [],
        totalCount: query.data?.count ?? 0,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        refetch: query.refetch,
    }
}

export function useSaleDelivery(id: number | null) {
    return useQuery({
        queryKey: SALES_KEYS.delivery(id ?? 0),
        queryFn: () => salesApi.getDelivery(id as number),
        enabled: !!id,
        staleTime: 2 * 60 * 1000,
    })
}
