import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface Warehouse {
    id: number
    name: string
    code: string
    address: string
}

export const WAREHOUSES_QUERY_KEY = ['warehouses']

export function useWarehouses() {
    const queryClient = useQueryClient()

    const { data: warehouses, isLoading, refetch } = useQuery({
        queryKey: WAREHOUSES_QUERY_KEY,
        queryFn: async (): Promise<Warehouse[]> => {
            const response = await api.get('/inventory/warehouses/')
            return response.data.results || response.data
        },
        staleTime: 15 * 60 * 1000, // 15 min — datos de configuración
    })

    const deleteWarehouseMutation = useMutation({
        mutationFn: async (id: number) => {
            return api.delete(`/inventory/warehouses/${id}/`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: WAREHOUSES_QUERY_KEY })
        },
    })

    return {
        warehouses: warehouses ?? [],
        isLoading,
        refetch,
        deleteWarehouse: deleteWarehouseMutation.mutateAsync,
        isDeleting: deleteWarehouseMutation.isPending
    }
}
