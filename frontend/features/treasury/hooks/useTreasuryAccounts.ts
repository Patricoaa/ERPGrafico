import { showApiError } from "@/lib/errors"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { toast } from 'sonner'
import { treasuryApi } from '../api/treasuryApi'
import { TREASURY_ACCOUNTS_KEYS, PAYMENT_METHODS_KEYS } from './queryKeys'
import { useRealtime } from '@/features/realtime'
import type { TreasuryAccount, TreasuryAccountCreatePayload, TreasuryAccountUpdatePayload, TreasuryAccountProvisionPayload } from '../types'

export { TREASURY_ACCOUNTS_KEYS }

/**
 * Asistente de alta: crea una cuenta y auto-provisiona sus formas de pago.
 * Invalida cuentas + métodos de pago (ambos cambian en la misma operación).
 */
export function useProvisionAccount() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const provisionMutation = useMutation({
        mutationFn: (payload: TreasuryAccountProvisionPayload) =>
            treasuryApi.provisionAccount(payload),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Cuenta creada con sus formas de pago')
            invalidateCrossFeature(queryClient, [TREASURY_ACCOUNTS_KEYS.all, PAYMENT_METHODS_KEYS.all])
        },
        onError: (error: Error) => {
            showApiError(error, 'Error al crear la cuenta')
        },
    })

    return { provision: provisionMutation.mutateAsync, isProvisioning: provisionMutation.isPending }
}

export interface TreasuryAccountFilters {
    name?: string
    account_type?: string
}

interface UseTreasuryAccountsReturn {
    accounts: TreasuryAccount[]
    refetch: () => Promise<unknown>
    createAccount: (payload: TreasuryAccountCreatePayload) => Promise<TreasuryAccount>
    updateAccount: (params: { id: number, payload: TreasuryAccountUpdatePayload }) => Promise<TreasuryAccount>
    deleteAccount: (id: number) => Promise<void>
    isCreating: boolean
    isUpdating: boolean
    isLoading: boolean
}

export function useTreasuryAccounts({ filters }: { filters?: TreasuryAccountFilters } = {}): UseTreasuryAccountsReturn {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: accounts, isLoading, refetch } = useQuery({
        queryKey: [...TREASURY_ACCOUNTS_KEYS.lists(), filters],
        queryFn: () => treasuryApi.getAccounts(filters),
        staleTime: 5 * 60 * 1000,
    })

    const invalidate = () => {
        invalidateCrossFeature(queryClient, [TREASURY_ACCOUNTS_KEYS.lists(), TREASURY_ACCOUNTS_KEYS.details()])
    }

    const createMutation = useMutation({
        mutationFn: (payload: TreasuryAccountCreatePayload) =>
            treasuryApi.createAccount(payload),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Cuenta creada')
            invalidate()
        },
        onError: (error: Error) => {
            showApiError(error, 'Error al crear la cuenta')
        }
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number, payload: TreasuryAccountUpdatePayload }) =>
            treasuryApi.updateAccount(id, payload),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Cuenta actualizada')
            invalidate()
        },
        onError: (error: Error) => {
            showApiError(error, 'Error al actualizar la cuenta')
        }
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => treasuryApi.deleteAccount(id),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Cuenta eliminada')
            invalidate()
        },
        onError: () => {
            toast.error('Error al eliminar')
        }
    })

    return {
        accounts: (accounts as TreasuryAccount[]) ?? [],
        refetch,
        createAccount: createMutation.mutateAsync,
        updateAccount: updateMutation.mutateAsync,
        deleteAccount: deleteMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isLoading
    }
}
