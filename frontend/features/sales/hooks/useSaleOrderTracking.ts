import { useQuery } from '@tanstack/react-query'
import { salesApi } from '../api/salesApi'
import type { SaleTrackingEvent } from '../types'
import { SALES_KEYS } from './queryKeys'

/** Seguimiento POS de una orden de venta (quién tocó cada paso). */
export function useSaleOrderTracking(orderId: number | null, enabled = true) {
    return useQuery<SaleTrackingEvent[]>({
        queryKey: SALES_KEYS.orderTracking(orderId ?? 0),
        queryFn: () => salesApi.getOrderTracking(orderId as number),
        enabled: enabled && orderId !== null,
    })
}
