import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useStockReport() {
    const { data: report, isLoading, refetch } = useQuery({
        queryKey: ['stockReport'],
        queryFn: async (): Promise<unknown[]> => {
            const response = await api.get<unknown[]>('/inventory/products/stock_report/')
            // eslint-disable-next-line pagination/no-raw-response-data -- custom @action, not paginated
            return response.data
        },
        staleTime: 5 * 60 * 1000, // 5 min — reporte costoso
    })

    return {
        report: report ?? [],
        isLoading,
        refetch,
    }
}
