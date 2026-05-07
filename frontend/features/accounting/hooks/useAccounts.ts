import { showApiError } from "@/lib/errors"
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { accountingApi } from '../api/accountingApi'
import type { AccountFilters, AccountPayload, Account } from '../types'
import { toast } from 'sonner'

export const ACCOUNTS_QUERY_KEY = ['accounts']

interface UseAccountsProps {
    filters?: AccountFilters
}

const EMPTY_ARRAY: Account[] = []

import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function useAccounts({ filters }: UseAccountsProps = {}) {
    const queryClient = useQueryClient()

    const { data: accounts, refetch } = useSuspenseQuery({
        queryKey: [...ACCOUNTS_QUERY_KEY, filters],
        queryFn: () => accountingApi.getAccounts(filters),
    })

    const createMutation = useMutation({
        mutationFn: (payload: AccountPayload) => accountingApi.createAccount(payload),
        onSuccess: () => {
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
            queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY })
            toast.success('Cuenta eliminada exitosamente')
        },
        onError: (error: Error) => {
            showApiError(error, 'Error al eliminar la cuenta')
        }
    })

    return {
        accounts: accounts || EMPTY_ARRAY,
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
