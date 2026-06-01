"use client"

import { showApiError } from "@/lib/errors"
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { accountingApi } from '../api/accountingApi'
import type { AccountPayload } from '../types'
import { toast } from 'sonner'

import { ACCOUNTS_QUERY_KEY } from './queryKeys'

export function useAccountMutations() {
    const queryClient = useQueryClient()

    const createAccount = useMutation({
        mutationFn: (payload: AccountPayload) => accountingApi.createAccount(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY })
            toast.success('Cuenta creada exitosamente')
        },
        onError: (error: Error) => {
            showApiError(error, 'Error al crear la cuenta')
        }
    })

    const updateAccount = useMutation({
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

    const deleteAccount = useMutation({
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
        createAccount: createAccount.mutateAsync,
        updateAccount: updateAccount.mutateAsync,
        deleteAccount: deleteAccount.mutateAsync,
        isCreating: createAccount.isPending,
        isUpdating: updateAccount.isPending,
        isDeleting: deleteAccount.isPending,
    }
}
