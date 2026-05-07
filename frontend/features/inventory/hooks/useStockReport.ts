import { useSuspenseQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useStockReport() {
    const { data: report, refetch } = useSuspenseQuery({
        queryKey: ['stockReport'],
        queryFn: async (): Promise<any[]> => {
            const response = await api.get('/inventory/products/stock_report/')
            return response.data
        },
    })

    return {
        report,
        refetch,
    }
}
