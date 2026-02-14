import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { treasuryApi } from '../api/treasuryApi'
import type { TreasuryAccount } from '../types'

export const ACCOUNTS_QUERY_KEY = ['treasury-accounts']

interface UseTreasuryAccountsReturn {
    accounts: TreasuryAccount[]
    refetch: () => Promise<any>
    deleteAccount: (id: number) => Promise<void>
}

/**
 * Custom hook for managing treasury accounts using React Query
 */
export function useTreasuryAccounts(): UseTreasuryAccountsReturn {
    const queryClient = useQueryClient()

    const { data: accounts, refetch } = useSuspenseQuery({
        queryKey: ACCOUNTS_QUERY_KEY,
        queryFn: treasuryApi.getAccounts,
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
        if (!confirm('¿Está seguro de eliminar esta cuenta?')) {
            return
        }
        await deleteMutation.mutateAsync(id)
    }

    return {
        accounts,
        refetch,
        deleteAccount,
    }
}
