import { useSuspenseQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useDeliveryData(orderId: number) {
    const orderQuery = useSuspenseQuery({
        queryKey: ['salesOrder', orderId],
        queryFn: async () => {
            const response = await api.get(`/sales/orders/${orderId}/`)
            return response.data
        },
    })

    const warehousesQuery = useSuspenseQuery({
        queryKey: ['warehouses'],
        queryFn: async () => {
            const response = await api.get('/inventory/warehouses/')
            return response.data.results || response.data
        },
    })

    return {
        order: orderQuery.data,
        warehouses: warehousesQuery.data,
        refetch: () => {
            orderQuery.refetch()
            warehousesQuery.refetch()
        }
    }
}
