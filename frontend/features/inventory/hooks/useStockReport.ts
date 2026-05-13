import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useStockReport() {
    const { data: report, isLoading, refetch } = useQuery({
        queryKey: ['stockReport'],
        queryFn: async (): Promise<any[]> => {
            const response = await api.get('/inventory/products/stock_report/')
            return response.data
        },
    })

    return {
        report: report ?? [],
        isLoading,
        refetch,
    }
}
