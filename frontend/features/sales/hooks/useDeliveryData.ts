import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useDeliveryData(orderId: number) {
    const orderQuery = useQuery({
        queryKey: ['salesOrder', orderId],
        queryFn: async () => {
            const response = await api.get(`/sales/orders/${orderId}/`)
            return response.data
        },
    })

    const warehousesQuery = useQuery({
        queryKey: ['warehouses'],
        queryFn: async () => {
            const response = await api.get('/inventory/warehouses/')
            return response.data.results || response.data
        },
    })

    return {
        order: orderQuery.data,
        warehouses: warehousesQuery.data ?? [],
        isLoading: orderQuery.isLoading || warehousesQuery.isLoading,
        refetch: () => {
            orderQuery.refetch()
            warehousesQuery.refetch()
        }
    }
}
