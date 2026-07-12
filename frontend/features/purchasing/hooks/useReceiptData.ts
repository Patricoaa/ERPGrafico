import { useQuery } from '@tanstack/react-query'
import { purchasingApi } from '../api/purchasingApi'
import { PURCHASING_KEYS } from './queryKeys'

export function useReceiptData(orderId: number | null, enabled: boolean) {
    const orderQuery = useQuery({
        queryKey: orderId ? [...PURCHASING_KEYS.orders(), 'detail', orderId] : [...PURCHASING_KEYS.orders(), 'noop'],
        queryFn: () => purchasingApi.getOrder(orderId!),
        staleTime: 30_000,
        enabled: enabled && !!orderId,
    })

    const warehousesQuery = useQuery({
        queryKey: PURCHASING_KEYS.orders(),
        queryFn: () => purchasingApi.getWarehouses(),
        staleTime: 10 * 60 * 1000,
        enabled,
    })

    const isLoading = orderQuery.isLoading || warehousesQuery.isLoading

    return {
        order: orderQuery.data ?? null,
        warehouses: warehousesQuery.data ?? [],
        isLoading,
    }
}
