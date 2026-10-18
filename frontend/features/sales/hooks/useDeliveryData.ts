import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { staleTime } from '@/lib/query-config'
import { fetchProductStockLevel, useWarehouses } from '@/features/inventory'
import type { OrderLine } from '@/features/orders'

/** What the dispatch drawer reads from the order detail. */
export interface DeliveryOrder {
    id: number
    number: string
    customer_name: string
    lines: OrderLine[]
    delivery_status: string
}

export function useDeliveryData(orderId: number) {
    const orderQuery = useQuery({
        queryKey: ['salesOrder', orderId],
        queryFn: async () => {
            const response = await api.get<DeliveryOrder>(`/sales/orders/${orderId}/`)
            return response.data
        },
        staleTime: staleTime.standard, // 2 min
    })

    // Shared master-data query: the endpoint returns a plain array (TC-058: the old copy read `.results`).
    const { warehouses, isLoading: warehousesLoading } = useWarehouses()

    return {
        order: orderQuery.data,
        warehouses,
        isLoading: orderQuery.isLoading || warehousesLoading,
        refetch: () => orderQuery.refetch(),
    }
}

/**
 * Stock of each product in the dispatch warehouse (one request per product, as before, but cached
 * per product and warehouse). A failed lookup reads as 0, the conservative value for a dispatch.
 */
export function useDeliveryStock(productIds: readonly number[], warehouseId: number | null | undefined) {
    const results = useQueries({
        queries: productIds.map((productId) => ({
            queryKey: ['stockLevel', productId, warehouseId],
            queryFn: () => fetchProductStockLevel(productId, warehouseId as number).catch(() => 0),
            enabled: !!warehouseId,
            staleTime: staleTime.volatile,
        })),
    })
    // Stable while the levels do not change: the dispatch rows and their schema derive from it.
    const signature = results.map((r, i) => `${productIds[i]}:${r.data ?? ''}`).join(',')
    const stock = useMemo(() => {
        const map = new Map<number, number>()
        results.forEach((r, i) => {
            if (r.data !== undefined) map.set(productIds[i], r.data)
        })
        return map
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` captures results and ids
    }, [signature])
    return { stock, isLoading: results.some((r) => r.isLoading) }
}
