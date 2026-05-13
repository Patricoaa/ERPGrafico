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

export interface StockMoveFilters {
    page?: number
    page_size?: number
    product?: string | number
    warehouse?: string | number
    move_type?: string
    date_from?: string
    date_to?: string
}

export interface PaginatedStockMoves {
    count: number
    next: string | null
    previous: string | null
    results: StockMove[]
}

export const STOCK_MOVES_QUERY_KEY = ['inventory', 'stockMoves'] as const

export function useStockMoves(filters: StockMoveFilters = {}) {
    const { page = 1, page_size = 50, ...rest } = filters

    const queryInfo = useQuery<PaginatedStockMoves>({
        queryKey: [...STOCK_MOVES_QUERY_KEY, { page, page_size, ...rest }],
        queryFn: async ({ signal }): Promise<PaginatedStockMoves> => {
            const params: Record<string, any> = { page, page_size, ...rest }
            const response = await api.get('/inventory/moves/', { params, signal })
            return response.data
        },
        staleTime: 2 * 60 * 1000, // 2 min
    })

    return queryInfo
}

/**
 * @deprecated Usa `useStockMoves(filters)` directamente.
 * Este wrapper mantiene la forma de retorno `{ moves, isLoading, refetch }`
 * para no romper consumidores en esta iteración.
 */
export function useStockMovesList(filters: StockMoveFilters = {}) {
    const query = useStockMoves(filters)
    return {
        moves: query.data?.results ?? [],
        totalCount: query.data?.count ?? 0,
        isLoading: query.isLoading,
        refetch: query.refetch,
    }
}
