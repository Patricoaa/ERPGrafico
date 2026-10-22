import { useQuery } from '@tanstack/react-query'
import { salesApi } from '../api/salesApi'
import type { SaleDelivery } from '../entity-view/saleDelivery.entity'
import type { SaleReturn } from '../entity-view/saleReturn.entity'
import type { SaleFulfillment } from '../entity-view/saleFulfillment.entity'
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

/** Unified list of deliveries + returns (fulfillment documents). */
export function useSaleFulfillment(filters?: Record<string, unknown>) {
    const page = Number(filters?.page ?? 1)
    const pageSize = Number(filters?.page_size ?? 50)
    const typeFilter = filters?.fulfillment_type as string | undefined

    const deliveriesQuery = useQuery({
        queryKey: SALES_KEYS.deliveries({ page, page_size: pageSize, ...filters }),
        queryFn: () => salesApi.getDeliveriesPaginated({ page, page_size: pageSize, ...filters }),
        staleTime: staleTime.standard,
        enabled: !typeFilter || typeFilter === 'DELIVERY',
    })

    const returnsQuery = useQuery({
        queryKey: SALES_KEYS.returns({ page, page_size: pageSize, ...filters }),
        queryFn: () => salesApi.getReturnsPaginated({ page, page_size: pageSize, ...filters }),
        staleTime: staleTime.standard,
        enabled: !typeFilter || typeFilter === 'RETURN',
    })

    const isLoading = deliveriesQuery.isLoading || returnsQuery.isLoading
    const isFetching = deliveriesQuery.isFetching || returnsQuery.isFetching
    const isError = deliveriesQuery.isError || returnsQuery.isError

    const deliveryResults = (deliveriesQuery.data?.results ?? []) as unknown as SaleDelivery[]
    const returnResults = (returnsQuery.data?.results ?? []) as unknown as SaleReturn[]

    // Merge and add fulfillment_type discriminator
    // Map delivery_date to date for DELIVERY type
    const merged: SaleFulfillment[] = [
        ...deliveryResults.map(d => ({ ...d, fulfillment_type: 'DELIVERY' as const, date: d.delivery_date })),
        ...returnResults.map(r => ({ ...r, fulfillment_type: 'RETURN' as const })),
    ]

    // Sort by date desc (newest first)
    merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Apply pagination manually on merged results (since we fetch full pages from both)
    const start = (page - 1) * pageSize
    const paginated = merged.slice(start, start + pageSize)
    const totalCount = merged.length

    return {
        page: { count: totalCount, results: paginated, next: null, previous: null },
        fulfillments: paginated,
        totalCount,
        isLoading,
        isFetching,
        isError,
        refetch: () => { deliveriesQuery.refetch(); returnsQuery.refetch(); },
    }
}
