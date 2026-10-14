import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { staleTime } from '@/lib/query-config'

export function useDeliveryData(orderId: number) {
    const orderQuery = useQuery({
        queryKey: ['salesOrder', orderId],
        queryFn: async () => {
            const response = await api.get(`/sales/orders/${orderId}/`)
            return response.data
        },
        staleTime: staleTime.standard, // 2 min
    })

    const warehousesQuery = useQuery({
        queryKey: ['warehouses'],
        queryFn: async () => {
            const response = await api.get('/inventory/warehouses/')
            return response.data.results
        },
        staleTime: staleTime.reference, // 15 min — estáticos
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
