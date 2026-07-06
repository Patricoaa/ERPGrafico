import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateCrossFeature } from '@/lib/invalidation'
import api from '@/lib/api'
import { toPage, type Page } from '@/lib/pagination'
import { useRealtime } from '@/features/realtime'
import { PRODUCTS_KEYS } from './queryKeys'

export interface StockMove {
    id: number
    display_id?: string
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
            const res = await api.get<T>(`/inventory/moves/${id}/`)
            return res.data
        },
        enabled: id !== null && id !== undefined && id !== '',
    })
}

export function useStockMoves(filters: StockMoveFilters = {}) {
    const { page = 1, page_size = 50, ...rest } = filters

    const { data: page_, isLoading, isFetching, refetch } = useQuery({
        queryKey: [...STOCK_MOVES_QUERY_KEY, { page, page_size, ...rest }],
        queryFn: async ({ signal }): Promise<Page<StockMove>> => {
            const params: Record<string, unknown> = { page, page_size, ...rest }
            const response = await api.get('/inventory/moves/', { params, signal })
            return toPage<StockMove>(response.data, page, page_size)
        },
        staleTime: 2 * 60 * 1000, // 2 min — tier "Transactional"
    })

    return {
        page: page_,
        moves: page_?.results ?? [],
        totalCount: page_?.count ?? 0,
        isLoading,
        isFetching,
        refetch,
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
 * Imperative one-shot fetch — total stock de un producto en una bodega.
 * El backend hace el SUM al nivel de DB; antes el frontend iteraba los
 * movimientos y sumaba en JS, lo que dejaba de funcionar al pasar a 50+
 * movimientos porque el endpoint listable está paginado.
 */
export async function fetchProductStockLevel(productId: number | string, warehouseId: number | string): Promise<number> {
    const response = await api.get<{ stock_level: string }>(
        `/inventory/moves/stock-level/?product_id=${productId}&warehouse_id=${warehouseId}`
    )
    return parseFloat(response.data.stock_level)
}

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
            invalidateCrossFeature(queryClient, [STOCK_MOVES_QUERY_KEY, PRODUCTS_KEYS.all])
        },
    })

    return {
        adjustStock: adjustMutation.mutateAsync,
        isAdjusting: adjustMutation.isPending,
    }
}
