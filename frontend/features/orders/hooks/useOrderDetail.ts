import { useQuery } from '@tanstack/react-query'
import { ordersApi } from '../api/ordersApi'
import type { UserPermissions } from '@/types/actions'
import { staleTime } from '@/lib/query-config'

const ORDERS_KEYS = {
    order: (id: string | number, type: string) => ['orders', type, id] as const,
    userPermissions: () => ['orders', 'user-permissions'] as const,
}

export function useOrderDetail(orderId: string | number | null, orderType: 'purchase' | 'sale', enabled: boolean) {
    const orderQuery = useQuery({
        queryKey: ORDERS_KEYS.order(orderId ?? 0, orderType),
        queryFn: () => {
            return orderType === 'purchase'
                ? ordersApi.getPurchaseOrder(orderId as string | number)
                : ordersApi.getSaleOrder(orderId as string | number)
        },
        staleTime: staleTime.volatile,
        enabled: enabled && !!orderId,
    })

    const userQuery = useQuery({
        queryKey: ORDERS_KEYS.userPermissions(),
        queryFn: async () => {
            const data = await ordersApi.getCurrentUser()
            return {
                permissions: (data as Record<string, unknown>).permissions || [],
                isSuperuser: (data as Record<string, unknown>).is_superuser || false,
            } as UserPermissions
        },
        staleTime: staleTime.stable,
        enabled,
    })

    const isLoading = orderQuery.isLoading || userQuery.isLoading

    return {
        order: orderQuery.data ?? null,
        userPermissions: userQuery.data ?? null,
        isLoading,
        refetch: () => {
            orderQuery.refetch()
        },
    }
}
