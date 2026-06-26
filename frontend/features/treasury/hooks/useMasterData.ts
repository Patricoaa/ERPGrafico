import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRealtime } from '@/features/realtime'
import { toast } from 'sonner'
import { treasuryApi } from '../api/treasuryApi'
import { BANKS_KEYS, PAYMENT_METHODS_KEYS } from './queryKeys'
import type { Bank, BankCreatePayload, BankUpdatePayload } from '../types'
import type { PaymentMethod, PaymentMethodCreatePayload, PaymentMethodUpdatePayload } from '../types'
import { getErrorMessage } from '@/lib/errors'
import { ALLOWED_PAYMENT_METHODS_KEYS } from '@/hooks/useAllowedPaymentMethods'

export type { Bank, PaymentMethod }
export { BANKS_KEYS, PAYMENT_METHODS_KEYS }

export function useBanks() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: banks, isLoading, refetch } = useQuery<Bank[]>({
        queryKey: BANKS_KEYS.list(),
        queryFn: treasuryApi.getBanks,
        staleTime: 15 * 60 * 1000,
    })

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: BANKS_KEYS.all })
    }

    const createMutation = useMutation({
        mutationFn: (payload: BankCreatePayload) => treasuryApi.createBank(payload),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
            toast.success('Banco creado')
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: BankUpdatePayload }) =>
            treasuryApi.updateBank(id, payload),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
            toast.success('Banco actualizado')
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    })

    const archiveMutation = useMutation({
        mutationFn: (id: number) => treasuryApi.archiveBank(id),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
            toast.success('Banco archivado')
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    })

    const restoreMutation = useMutation({
        mutationFn: (id: number) => treasuryApi.restoreBank(id),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
            toast.success('Banco restaurado')
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => treasuryApi.deleteBank(id),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
            toast.success('Banco eliminado')
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    })

    return {
        banks: banks ?? [],
        isLoading,
        refetch,
        createBank: createMutation.mutateAsync,
        updateBank: updateMutation.mutateAsync,
        archiveBank: archiveMutation.mutateAsync,
        restoreBank: restoreMutation.mutateAsync,
        deleteBank: deleteMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isArchiving: archiveMutation.isPending,
        isRestoring: restoreMutation.isPending,
    }
}

export function usePaymentMethods() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: methods, isLoading, refetch } = useQuery<PaymentMethod[]>({
        queryKey: PAYMENT_METHODS_KEYS.list(),
        queryFn: treasuryApi.getPaymentMethods,
        staleTime: 15 * 60 * 1000,
    })

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_KEYS.all })
        queryClient.invalidateQueries({ queryKey: ALLOWED_PAYMENT_METHODS_KEYS.all })
    }

    const createMutation = useMutation({
        mutationFn: (payload: PaymentMethodCreatePayload) => treasuryApi.createPaymentMethod(payload),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
            toast.success('Método creado')
        },
        onError: () => toast.error('Error al guardar método'),
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: PaymentMethodUpdatePayload }) =>
            treasuryApi.updatePaymentMethod(id, payload),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
            toast.success('Método actualizado')
        },
        onError: () => toast.error('Error al guardar método'),
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => treasuryApi.deletePaymentMethod(id),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
            toast.success('Método eliminado')
        },
        onError: () => toast.error('Error al eliminar'),
    })

    return {
        methods: methods ?? [],
        isLoading,
        refetch,
        createMethod: createMutation.mutateAsync,
        updateMethod: updateMutation.mutateAsync,
        deleteMethod: deleteMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
    }
}
