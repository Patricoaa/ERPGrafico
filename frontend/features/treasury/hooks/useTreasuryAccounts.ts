import { showApiError } from "@/lib/errors"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { treasuryApi } from '../api/treasuryApi'
import type { TreasuryAccount, TreasuryAccountCreatePayload, TreasuryAccountUpdatePayload } from '../types'

import { ACCOUNTS_QUERY_KEY } from './queryKeys'

export { ACCOUNTS_QUERY_KEY }

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

    const { data: accounts, isLoading, refetch } = useQuery({
        queryKey: [...ACCOUNTS_QUERY_KEY, filters],
        queryFn: () => treasuryApi.getAccounts(filters),
        staleTime: 5 * 60 * 1000, // 5 min
    })

    const createMutation = useMutation({
        mutationFn: async (payload: TreasuryAccountCreatePayload) => {
            return treasuryApi.createAccount(payload)
        },
        onSuccess: () => {
            toast.success('Cuenta creada')
            queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY })
        },
        onError: (error: Error) => {
            showApiError(error, 'Error al crear la cuenta')
        }
    })

    const updateMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: number, payload: TreasuryAccountUpdatePayload }) => {
            return treasuryApi.updateAccount(id, payload)
        },
        onSuccess: () => {
            toast.success('Cuenta actualizada')
            queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY })
        },
        onError: (error: Error) => {
            showApiError(error, 'Error al actualizar la cuenta')
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            return treasuryApi.deleteAccount(id)
        },
        onSuccess: () => {
            toast.success('Cuenta eliminada')
            queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY })
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
