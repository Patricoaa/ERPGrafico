import { showApiError } from "@/lib/errors"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { treasuryApi } from '../api/treasuryApi'
import type { TreasuryAccount } from '../types'

export const ACCOUNTS_QUERY_KEY = ['treasury-accounts']

interface UseTreasuryAccountsReturn {
    accounts: TreasuryAccount[]
    refetch: () => Promise<any>
    createAccount: (payload: any) => Promise<TreasuryAccount>
    updateAccount: (params: { id: number, payload: any }) => Promise<TreasuryAccount>
    deleteAccount: (id: number) => Promise<void>
    isCreating: boolean
    isUpdating: boolean
    isLoading: boolean
}

/**
 * Custom hook for managing treasury accounts using React Query
 */
export function useTreasuryAccounts(): UseTreasuryAccountsReturn {
    const queryClient = useQueryClient()

    const { data: accounts = [], refetch, isLoading } = useQuery({
        queryKey: ACCOUNTS_QUERY_KEY,
        queryFn: treasuryApi.getAccounts,
    })

    const createMutation = useMutation({
        mutationFn: async (payload: any) => {
            return treasuryApi.createAccount(payload)
        },
        onSuccess: () => {
            toast.success('Cuenta creada')
            queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY })
        },
        onError: (error: any) => {
            showApiError(error, 'Error al crear la cuenta')
        }
    })

    const updateMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: number, payload: any }) => {
            return treasuryApi.updateAccount(id, payload)
        },
        onSuccess: () => {
            toast.success('Cuenta actualizada')
            queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY })
        },
        onError: (error: any) => {
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

    const deleteAccount = async (id: number) => {
        await deleteMutation.mutateAsync(id)
    }

    return {
        accounts,
        refetch,
        createAccount: createMutation.mutateAsync,
        updateAccount: updateMutation.mutateAsync,
        deleteAccount,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isLoading
    }
}
