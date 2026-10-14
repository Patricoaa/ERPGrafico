import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { staleTime } from '@/lib/query-config'

export function useStockReport(warehouseId?: string | null) {
    const params: Record<string, string> = {}
    if (warehouseId) {
        params.warehouse_id = warehouseId
    }

    const { data: report, isLoading, refetch } = useQuery({
        queryKey: ['stockReport', warehouseId],
        queryFn: async (): Promise<unknown[]> => {
            const response = await api.get<unknown[]>('/inventory/products/stock_report/', { params })
            // eslint-disable-next-line pagination/no-raw-response-data -- custom @action, not paginated
            return response.data
        },
        staleTime: staleTime.stable, // 5 min — reporte costoso
    })

    return {
        report: report ?? [],
        isLoading,
        refetch,
    }
}
