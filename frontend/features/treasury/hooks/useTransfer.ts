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
        mutationFn: (payload: TransferPayload) => treasuryApi.registerTransfer(payload),
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
