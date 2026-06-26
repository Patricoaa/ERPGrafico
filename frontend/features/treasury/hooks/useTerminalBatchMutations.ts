"use client"

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRealtime } from '@/features/realtime'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { treasuryApi } from '../api/treasuryApi'
import { BATCHES_KEYS } from './queryKeys'
import type { TerminalBatchCreatePayload } from '../types'

export function useTerminalBatchMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const createBatch = useMutation({
        mutationFn: (payload: TerminalBatchCreatePayload) => treasuryApi.createTerminalBatch(payload),
        onSuccess: () => {
            markLocalMutation()
            queryClient.invalidateQueries({ queryKey: BATCHES_KEYS.all })
            toast.success('Liquidación registrada exitosamente')
        },
        onError: (err) => showApiError(err, 'Error al registrar liquidación'),
    })

    return {
        createBatch: createBatch.mutateAsync,
        isCreating: createBatch.isPending,
    }
}
