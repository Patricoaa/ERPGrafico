import { useQuery } from '@tanstack/react-query'
import { salesApi } from '../api/salesApi'
import type { SaleDelivery } from '../entity-view/saleDelivery.entity'
import type { SaleReturn } from '../entity-view/saleReturn.entity'
import { SALES_KEYS } from './queryKeys'
import { staleTime } from '@/lib/query-config'

export function useSaleDeliveries(filters?: Record<string, unknown>) {
    const page = Number(filters?.page ?? 1)
    const pageSize = Number(filters?.page_size ?? 50)
    const query = useQuery({
        queryKey: SALES_KEYS.deliveries({ page, page_size: pageSize, ...filters }),
        queryFn: () => salesApi.getDeliveriesPaginated({ page, page_size: pageSize, ...filters }),
        staleTime: staleTime.standard,
    })

    return {
        page: query.data,
        deliveries: (query.data?.results ?? []) as unknown as SaleDelivery[],
        totalCount: query.data?.count ?? 0,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        isError: query.isError,
        refetch: query.refetch,
    }
}

export function useSaleDelivery(id: number | null) {
    return useQuery({
        queryKey: SALES_KEYS.delivery(id ?? 0),
        queryFn: () => salesApi.getDelivery(id as number),
        enabled: !!id,
        staleTime: staleTime.standard,
    })
}

export function useSaleReturn(id: number | null, enabled = true) {
    const { data, isLoading } = useQuery({
        queryKey: SALES_KEYS.return(id ?? 0),
        queryFn: () => salesApi.getReturn(id as number),
        enabled: !!id && enabled,
        staleTime: staleTime.standard,
    })
    return { data, isLoading }
}

/** Paginated list of sale returns (ADR-0090: "Devoluciones" is its own document list). */
export function useSaleReturns(filters?: Record<string, unknown>) {
    const page = Number(filters?.page ?? 1)
    const pageSize = Number(filters?.page_size ?? 50)
    const query = useQuery({
        queryKey: SALES_KEYS.returns({ page, page_size: pageSize, ...filters }),
        queryFn: () => salesApi.getReturnsPaginated({ page, page_size: pageSize, ...filters }),
        staleTime: staleTime.standard,
    })

    return {
        page: query.data,
        returns: (query.data?.results ?? []) as unknown as SaleReturn[],
        totalCount: query.data?.count ?? 0,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        isError: query.isError,
        refetch: query.refetch,
    }
}
