import { showApiError } from "@/lib/errors"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { accountingApi } from '../api/accountingApi'
import type { AccountFilters, AccountPayload, Account } from '../types'
import { toast } from 'sonner'

import { ACCOUNTS_QUERY_KEY, ACCOUNTS_MAPPINGS_QUERY_KEY } from './queryKeys'

export { ACCOUNTS_QUERY_KEY, ACCOUNTS_MAPPINGS_QUERY_KEY }

interface UseAccountsProps {
    filters?: AccountFilters
}

const EMPTY_ARRAY: Account[] = []


export function useAccounts({ filters }: UseAccountsProps = {}) {
    const queryClient = useQueryClient()

    const { data: accounts, isLoading, refetch } = useQuery({
        queryKey: [...ACCOUNTS_QUERY_KEY, filters],
        queryFn: () => accountingApi.getAccounts(filters),
        staleTime: 15 * 60 * 1000, // 15 min — datos quasi-estáticos
    })

    const createMutation = useMutation({
        mutationFn: (payload: AccountPayload) => accountingApi.createAccount(payload),
        onSuccess: () => {
            // Accounts QUERY_KEY prefix invalidation covers mappings slice too
            queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY })
            toast.success('Cuenta creada exitosamente')
        },
        onError: (error: Error) => {
            showApiError(error, 'Error al crear la cuenta')
        }
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number, payload: Partial<AccountPayload> }) =>
            accountingApi.updateAccount(id, payload),
        onSuccess: () => {
            // Prefix match: invalidates both ['accounts', ...filters] AND ['accounts', 'mappings']
            queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY })
            toast.success('Cuenta actualizada exitosamente')
        },
        onError: (error: Error) => {
            showApiError(error, 'Error al actualizar la cuenta')
        }
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => accountingApi.deleteAccount(id),
        onSuccess: () => {
            // Prefix match: invalidates list + mappings slice
            queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY })
            toast.success('Cuenta eliminada exitosamente')
        },
        onError: (error: Error) => {
            showApiError(error, 'Error al eliminar la cuenta')
        }
    })

    return {
        accounts: accounts || EMPTY_ARRAY,
        isLoading,
        refetch,
        createAccount: createMutation.mutateAsync,
        updateAccount: updateMutation.mutateAsync,
        deleteAccount: deleteMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending
    }
}

export const useAccountingAccounts = useAccounts
