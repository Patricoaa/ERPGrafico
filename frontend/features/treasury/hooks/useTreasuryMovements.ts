import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { treasuryApi } from '../api/treasuryApi'
import { MOVEMENTS_KEYS } from './queryKeys'
import type { MovementCreatePayload } from '../types'

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

export interface TreasuryMovementFilters {
    treasury_account?: string | number
    movement_type?: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT'
    date?: string
    date_from?: string
    date_to?: string
    amount_min?: number | string
    amount_max?: number | string
    direction?: 'IN' | 'OUT'
    is_reconciled?: boolean
    payment_method_new?: string | number
    page?: number
    page_size?: number
}

export interface PaginatedMovements {
    count: number
    next: string | null
    previous: string | null
    results: TreasuryMovement[]
}

/** @deprecated Use `useTreasuryMovements(filters)` directly. */
export function useTreasuryMovementsList(filters: TreasuryMovementFilters = {}) {
    const query = useTreasuryMovements(filters)
    return {
        movements: query.movements,
        totalCount: query.totalCount,
        isLoading: query.isLoading,
        refetch: query.refetch,
        hasNextPage: query.hasNextPage,
        hasPrevPage: query.hasPrevPage,
    }
}

export function useTreasuryMovements(filters: TreasuryMovementFilters = {}) {
    const queryClient = useQueryClient()
    const { page_size = 50, page = 1, ...rest } = filters

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

    const { data, isLoading, refetch } = useQuery<PaginatedMovements>({
        queryKey: [MOVEMENTS_KEYS.lists(), { page, page_size, ...rest }],
        queryFn: ({ signal }) => treasuryApi.getMovements(params, signal),
        staleTime: 2 * 60 * 1000,
    })

    const createMovement = useMutation({
        mutationFn: (payload: MovementCreatePayload) => treasuryApi.createMovement(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEYS.all })
            toast.success('Movimiento registrado correctamente')
        },
        onError: (err) => {
            showApiError(err, 'Error al registrar movimiento')
        },
    })

    return {
        data,
        movements: data?.results ?? [],
        totalCount: data?.count ?? 0,
        isLoading,
        refetch,
        hasNextPage: !!data?.next,
        hasPrevPage: !!data?.previous,
        createMovement: createMovement.mutateAsync,
        isCreating: createMovement.isPending,
    }
}
