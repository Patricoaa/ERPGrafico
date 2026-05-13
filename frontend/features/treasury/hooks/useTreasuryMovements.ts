import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface TreasuryMovement {
    id: number
    display_id: string
    movement_type: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT'
    movement_type_display: string
    payment_method: string
    payment_method_display: string
    amount: number
    created_at: string
    date: string
    created_by_name: string
    notes: string
    pos_session: number | null
    from_account: number | null
    from_account_name: string | null
    from_account_account_id: number | null
    from_account_code: string | null
    to_account: number | null
    to_account_name: string | null
    to_account_account_id: number | null
    to_account_code: string | null
    justify_reason: string | null
    justify_reason_display: string | null
    partner_name: string | null
    partner_id: number | null
    reference: string | null
    involved_accounts?: string[]
    document_info?: {
        type: string | null
        id: number | null
        number: string | null
        label: string | null
    } | null
}

/**
 * Filtros soportados por TreasuryMovementViewSet.get_queryset()
 * y filterset_fields = ['is_reconciled', 'movement_type', 'payment_method',
 * 'payment_method_new', 'contact'].
 */
export interface TreasuryMovementFilters {
    /** Cuenta de tesorería — filtra en from_account OR to_account */
    treasury_account?: string | number
    /** Tipo de movimiento */
    movement_type?: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT'
    /** Fecha exacta (YYYY-MM-DD) */
    date?: string
    /** Desde (inclusive) */
    date_from?: string
    /** Hasta (inclusive) */
    date_to?: string
    /** Monto mínimo */
    amount_min?: number | string
    /** Monto máximo */
    amount_max?: number | string
    /** Dirección relativa a treasury_account: 'IN' | 'OUT' */
    direction?: 'IN' | 'OUT'
    /** Estado de conciliación */
    is_reconciled?: boolean
    /** ID de método de pago */
    payment_method_new?: string | number
    /** Página actual (para paginación) */
    page?: number
    /** Resultados por página — default 50 */
    page_size?: number
}

export interface PaginatedMovements {
    count: number
    next: string | null
    previous: string | null
    results: TreasuryMovement[]
}

import { TREASURY_MOVEMENTS_QUERY_KEY } from './queryKeys'

export { TREASURY_MOVEMENTS_QUERY_KEY }

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetches treasury movements with server-side filtering and pagination.
 *
 * Fase 2 — reemplaza el fetch sin límite anterior que descargaba todos los
 * movimientos. Ahora usa page_size: 50 por defecto y expone los filtros que
 * soporta el backend directamente en el tipo `TreasuryMovementFilters`.
 *
 * El queryKey incluye los filtros activos para que cada combinación tenga
 * su propia entrada en el cache de TanStack Query.
 */
export function useTreasuryMovements(filters: TreasuryMovementFilters = {}) {
    const { page_size = 50, page = 1, ...rest } = filters

    return useQuery<PaginatedMovements>({
        queryKey: [...TREASURY_MOVEMENTS_QUERY_KEY, { page, page_size, ...rest }],
        queryFn: async ({ signal }) => {
            const params: Record<string, string | number | boolean> = {
                page,
                page_size,
            }

            if (rest.treasury_account) params.treasury_account = rest.treasury_account
            if (rest.movement_type)    params.movement_type    = rest.movement_type
            if (rest.date)             params.date             = rest.date
            if (rest.date_from)        params.date_from        = rest.date_from
            if (rest.date_to)          params.date_to          = rest.date_to
            if (rest.amount_min !== undefined) params.amount_min = rest.amount_min
            if (rest.amount_max !== undefined) params.amount_max = rest.amount_max
            if (rest.direction)        params.direction        = rest.direction
            if (rest.is_reconciled !== undefined) params.is_reconciled = rest.is_reconciled
            if (rest.payment_method_new) params.payment_method_new = rest.payment_method_new

            const response = await api.get<PaginatedMovements>('/treasury/movements/', {
                params,
                signal,
            })
            return response.data
        },
        staleTime: 2 * 60 * 1000, // 2 min
    })
}

// ─── Backwards-compatible flat list (para consumidores legacy que esperaban TreasuryMovement[]) ──

/**
 * @deprecated Usa `useTreasuryMovements(filters)` directamente.
 * Este wrapper mantiene la forma de retorno `{ movements, isLoading, refetch }`
 * para no romper `TreasuryMovementsClientView` en esta iteración.
 */
export function useTreasuryMovementsList(filters: TreasuryMovementFilters = {}) {
    const query = useTreasuryMovements(filters)
    return {
        movements: query.data?.results ?? [],
        totalCount: query.data?.count ?? 0,
        isLoading: query.isLoading,
        refetch: query.refetch,
        hasNextPage: !!query.data?.next,
        hasPrevPage: !!query.data?.previous,
    }
}
