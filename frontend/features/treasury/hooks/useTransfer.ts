import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { treasuryApi } from '../api/treasuryApi'
import { MOVEMENTS_KEYS, TREASURY_ACCOUNTS_KEYS } from './queryKeys'
import { useRealtime } from '@/features/realtime'
import type { TransferPayload } from '../types'

export function useTransfer() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const createTransfer = useMutation({
        // El endpoint exige Idempotency-Key (contrato idempotency.md); el key viaja en las variables
        mutationFn: ({ payload, idempotencyKey }: { payload: TransferPayload; idempotencyKey: string }) =>
            treasuryApi.registerTransfer(payload, idempotencyKey),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Traspaso registrado correctamente.')
            invalidateCrossFeature(queryClient, [MOVEMENTS_KEYS.all, TREASURY_ACCOUNTS_KEYS.all])
        },
        onError: (err) => {
            showApiError(err, 'Error al registrar el traspaso.')
        },
    })

    return {
        createTransfer: createTransfer.mutateAsync,
        isCreating: createTransfer.isPending,
    }
}
