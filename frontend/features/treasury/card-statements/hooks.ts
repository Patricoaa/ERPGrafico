import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { cardStatementsApi } from './api'
import type {
    CreditCardStatementCreatePayload, PayStatementPayload, ApplyChargesPayload,
} from './types'

const STMT_KEYS = {
    all: ['card-statements'] as const,
    lists: () => [...STMT_KEYS.all, 'list'] as const,
    list: (params?: Record<string, string>) => [...STMT_KEYS.lists(), params] as const,
    detail: (id: number) => [...STMT_KEYS.all, 'detail', id] as const,
}

export function useCardStatements(params?: Record<string, string>) {
    return useQuery({
        queryKey: STMT_KEYS.list(params),
        queryFn: () => cardStatementsApi.list(params),
        staleTime: 2 * 60 * 1000,
    })
}

export function useCardStatement(id: number | null) {
    return useQuery({
        queryKey: STMT_KEYS.detail(id ?? 0),
        queryFn: () => cardStatementsApi.get(id as number),
        enabled: id != null,
        staleTime: 60 * 1000,
    })
}

export function useStatementCharges(statementId: number | null) {
    return useQuery({
        queryKey: [...STMT_KEYS.detail(statementId ?? 0), 'charges'],
        queryFn: () => cardStatementsApi.getCharges(statementId as number),
        enabled: statementId != null,
        staleTime: 60 * 1000,
    })
}

export function useCardStatementMutations() {
    const queryClient = useQueryClient()

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: STMT_KEYS.all })
    }

    const create = useMutation({
        mutationFn: (payload: CreditCardStatementCreatePayload) => cardStatementsApi.create(payload),
        onSuccess: () => { invalidate(); toast.success('Estado de cuenta creado') },
        onError: (e: Error) => showApiError(e, 'Error al crear estado de cuenta'),
    })

    const pay = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: PayStatementPayload }) =>
            cardStatementsApi.pay(id, payload),
        onSuccess: () => { invalidate(); toast.success('Estado de cuenta pagado') },
        onError: (e: Error) => showApiError(e, 'Error al pagar estado de cuenta'),
    })

    const applyCharges = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: ApplyChargesPayload }) =>
            cardStatementsApi.applyCharges(id, payload),
        onSuccess: () => { invalidate(); toast.success('Cargos aplicados') },
        onError: (e: Error) => showApiError(e, 'Error al aplicar cargos'),
    })

    const cancel = useMutation({
        mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
            cardStatementsApi.cancel(id, notes),
        onSuccess: () => { invalidate(); toast.success('Estado de cuenta anulado') },
        onError: (e: Error) => showApiError(e, 'Error al anular estado de cuenta'),
    })

    return {
        create: create.mutateAsync,
        pay: pay.mutateAsync,
        applyCharges: applyCharges.mutateAsync,
        cancel: cancel.mutateAsync,
        isCreating: create.isPending,
        isPaying: pay.isPending,
        isApplyingCharges: applyCharges.isPending,
        isCanceling: cancel.isPending,
    }
}
