import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { treasuryApi } from '../api/treasuryApi'
import { MOVEMENTS_KEYS } from './queryKeys'
import type { MovementCreatePayload, TreasuryMovement, TreasuryMovementFilters } from '../types'

// Re-export so existing consumers `import { TreasuryMovement } from '@/features/treasury/hooks/useTreasuryMovements'`
// keep working without churn. Type itself now lives in `../types`.
export type { TreasuryMovement, TreasuryMovementFilters }

export function useTreasuryMovements(filters: TreasuryMovementFilters = {}) {
    const queryClient = useQueryClient()
    const { page_size = 50, page = 1, ...rest } = filters

    const params: Record<string, string | number | boolean> = { page, page_size }
    if (rest.treasury_account) params.treasury_account = rest.treasury_account
    if (rest.movement_type)    params.movement_type    = rest.movement_type
    if (rest.date)             params.date             = rest.date
    if (rest.date_from)        params.date_from        = rest.date_from
    if (rest.date_to)          params.date_to          = rest.date_to
    if (rest.amount_min !== undefined) params.amount_min = rest.amount_min
    if (rest.amount_max !== undefined) params.amount_max = rest.amount_max
    if (rest.direction)        params.direction        = rest.direction
    if (rest.is_reconciled !== undefined) params.is_reconciled = rest.is_reconciled
    if (rest.payment_method) params.payment_method = rest.payment_method
    if (rest.payment_method_new) params.payment_method_new = rest.payment_method_new
    if (rest.search)              params.search              = rest.search
    if (rest.display_id)          params.display_id          = rest.display_id
    if (rest.partner_name)        params.partner_name        = rest.partner_name

    const { data: page_, isLoading, isFetching, refetch } = useQuery({
        queryKey: [...MOVEMENTS_KEYS.lists(), { page, page_size, ...rest }],
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
        page: page_,
        movements: page_?.results ?? [],
        totalCount: page_?.count ?? 0,
        isLoading,
        isFetching,
        refetch,
        createMovement: createMovement.mutateAsync,
        isCreating: createMovement.isPending,
    }
}
