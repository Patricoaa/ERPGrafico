import { useQuery } from '@tanstack/react-query'
import { purchasingApi } from '../api/purchasingApi'
import { PURCHASING_KEYS } from './queryKeys'
import { staleTime } from '@/lib/query-config'
import { useWarehouses } from '@/features/inventory'

export function useReceiptData(orderId: number | null, enabled: boolean) {
    const orderQuery = useQuery({
        queryKey: orderId ? [...PURCHASING_KEYS.orders(), 'detail', orderId] : [...PURCHASING_KEYS.orders(), 'noop'],
        queryFn: () => purchasingApi.getOrder(orderId as number),
        staleTime: staleTime.volatile,
        enabled: enabled && !!orderId,
    })

    // Shared master-data query (one cache for every warehouse selector).
    const { warehouses, isLoading: warehousesLoading } = useWarehouses()
    const isLoading = orderQuery.isLoading || warehousesLoading

    return {
        order: orderQuery.data ?? null,
        warehouses,
        isLoading,
    }
}
