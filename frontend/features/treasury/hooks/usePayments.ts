import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { toast } from 'sonner'
import { treasuryApi } from '../api/treasuryApi'
import { PAYMENTS_KEYS } from './queryKeys'
import { useRealtime } from '@/features/realtime'
import type { PaymentUpdatePayload } from '../types'

export function usePaymentReference() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const updatePayment = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: PaymentUpdatePayload }) =>
            treasuryApi.updatePayment(id, payload),
        onSuccess: () => {
            markLocalMutation()
            toast.success('N° de operación registrado correctamente')
            invalidateCrossFeature(queryClient, [PAYMENTS_KEYS.all])
        },
        onError: () => {
            toast.error('Error al registrar el número de operación')
        },
    })

    return {
        updatePayment: updatePayment.mutateAsync,
        isUpdating: updatePayment.isPending,
    }
}
