import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface StockMove {
    id: number
    date: string
    product_name: string
    product_internal_code?: string
    product_code?: string
    warehouse_name: string
    quantity: string
    uom_name: string
    move_type: string
    description: string
    related_documents: Array<{
        type: string
        id: number | string
        name: string
    }>
}

export const STOCK_MOVES_QUERY_KEY = ['stockMoves']

export function useStockMoves() {
    const queryClient = useQueryClient()

    const { data: moves, isLoading, refetch } = useQuery({
        queryKey: STOCK_MOVES_QUERY_KEY,
        queryFn: async (): Promise<StockMove[]> => {
            const response = await api.get('/inventory/moves/')
            return response.data.results || response.data
        },
    })

    return {
        moves: moves ?? [],
        isLoading,
        refetch,
    }
}
