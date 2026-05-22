import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useRealtime } from '@/features/realtime'
import { PRODUCTS_KEYS } from './queryKeys'

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

/**
 * Fetch a single stock move by id (vista de detalle, modal de inspección).
 * Devuelve un superset de StockMove: la respuesta del endpoint incluye
 * `product_details`, `warehouse_details`, `uom_details`, `unit_cost`,
 * `adjustment_reason`, `journal_entry` que no están en el shape de la lista.
 * Tipado genérico para que el caller refine sin acoplar.
 */
export function useStockMove<T = StockMove>(id: string | number | null | undefined) {
    return useQuery<T>({
        queryKey: id ? [...STOCK_MOVES_QUERY_KEY, 'detail', id] : [...STOCK_MOVES_QUERY_KEY, 'detail', 'noop'],
        queryFn: async () => {
            const res = await api.get<T>(`/inventory/stock_moves/${id}/`)
            return res.data
        },
        enabled: id !== null && id !== undefined && id !== '',
    })
}

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

export interface StockAdjustmentPayload {
    product_id: number | string
    warehouse_id: number | string
    quantity: number
    uom_id: number | string
    unit_cost: number
    adjustment_reason: string
    description?: string
    partner_contact_id?: number | string
}

/**
 * Mutación del endpoint custom POST /inventory/moves/adjust/.
 * Cambia stock + costo del producto y crea un journal entry asociado.
 * Por eso invalida tanto STOCK_MOVES como PRODUCTS (qty_available/cost_price)
 * para que listas y detalles abiertos reflejen el ajuste inmediatamente.
 */
export function useStockAdjustment() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const adjustMutation = useMutation({
        mutationFn: async (payload: StockAdjustmentPayload) => {
            const res = await api.post('/inventory/moves/adjust/', payload)
            return res.data
        },
        onSuccess: () => {
            markLocalMutation()
            queryClient.invalidateQueries({ queryKey: STOCK_MOVES_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: PRODUCTS_KEYS.all })
        },
    })

    return {
        adjustStock: adjustMutation.mutateAsync,
        isAdjusting: adjustMutation.isPending,
    }
}
