import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { checksApi } from '../checks/api'
import type { CheckCreatePayload, CheckDepositPayload } from '../checks/types'
import { invalidateCrossFeature } from '@/lib/invalidation'

const CHECKS_KEYS = {
    all: ['checks'] as const,
    lists: () => [...CHECKS_KEYS.all, 'list'] as const,
    list: (params?: Record<string, string>) => [...CHECKS_KEYS.lists(), params] as const,
    portfolio: () => [...CHECKS_KEYS.all, 'portfolio'] as const,
    inTransit: () => [...CHECKS_KEYS.all, 'in_transit'] as const,
    detail: (id: number) => [...CHECKS_KEYS.all, 'detail', id] as const,
}

export function useChecks(params?: Record<string, string>) {
    return useQuery({
        queryKey: CHECKS_KEYS.list(params),
        queryFn: () => checksApi.list(params),
        staleTime: 2 * 60 * 1000,
    })
}

export function useCheck(id: number | null, enabled = true) {
    return useQuery({
        queryKey: CHECKS_KEYS.detail(id ?? 0),
        queryFn: () => checksApi.get(id as number),
        enabled: id != null && enabled,
        staleTime: 60 * 1000,
    })
}

export function useCheckPortfolio(params?: Record<string, string>, enabled = true) {
    return useQuery({
        queryKey: CHECKS_KEYS.portfolio(),
        queryFn: () => checksApi.portfolio(params),
        staleTime: 60 * 1000,
        enabled,
    })
}

export function useCheckInTransit(params?: Record<string, string>, enabled = true) {
    return useQuery({
        queryKey: CHECKS_KEYS.inTransit(),
        queryFn: () => checksApi.inTransit(params),
        staleTime: 60 * 1000,
        enabled,
    })
}

export function useCheckMutations() {
    const queryClient = useQueryClient()

    const invalidate = () => {
        invalidateCrossFeature(queryClient, [CHECKS_KEYS.all])
    }

    const create = useMutation({
        mutationFn: (payload: CheckCreatePayload) => checksApi.create(payload),
        onSuccess: () => { invalidate(); toast.success('Cheque registrado en cartera') },
        onError: (e: Error) => showApiError(e, 'Error al registrar cheque'),
    })

    const deposit = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: CheckDepositPayload }) =>
            checksApi.deposit(id, payload),
        onSuccess: () => { invalidate(); toast.success('Cheque depositado') },
        onError: (e: Error) => showApiError(e, 'Error al depositar cheque'),
    })

    const clear = useMutation({
        mutationFn: (id: number) => checksApi.clear(id),
        onSuccess: () => { invalidate(); toast.success('Cheque marcado como cobrado') },
        onError: (e: Error) => showApiError(e, 'Error al marcar cobrado'),
    })

    const bounce = useMutation({
        mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
            checksApi.bounce(id, notes),
        onSuccess: () => { invalidate(); toast.error('Cheque protestado') },
        onError: (e: Error) => showApiError(e, 'Error al protestar cheque'),
    })

    const voidCheck = useMutation({
        mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
            checksApi.void(id, notes),
        onSuccess: () => { invalidate(); toast.success('Cheque anulado') },
        onError: (e: Error) => showApiError(e, 'Error al anular cheque'),
    })

    const markCashed = useMutation({
        mutationFn: (id: number) => checksApi.markCashed(id),
        onSuccess: () => { invalidate(); toast.success('Cheque marcado como cobrado') },
        onError: (e: Error) => showApiError(e, 'Error al marcar cheque como cobrado'),
    })

    return {
        create: create.mutateAsync,
        deposit: deposit.mutateAsync,
        clear: clear.mutateAsync,
        bounce: bounce.mutateAsync,
        void: voidCheck.mutateAsync,
        markCashed: markCashed.mutateAsync,
        isCreating: create.isPending,
    }
}
