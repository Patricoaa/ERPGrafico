"use client"

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createPayroll } from '../api/hrApi'
import { toast } from 'sonner'
import { useRealtime } from '@/features/realtime'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { PAYROLLS_QUERY_KEY } from './usePayrolls'
import type { Payroll } from '@/types/hr'

export function usePayrollMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const invalidate = () => {
        invalidateCrossFeature(queryClient, [PAYROLLS_QUERY_KEY])
    }

    const savePayroll = useMutation({
        mutationFn: async ({ payload }: { payload: Partial<Payroll> }) => {
            // Note: Currently only create is supported in the hook
            return await createPayroll(payload)
        },
        onSuccess: () => {
            markLocalMutation()
            toast.success('Liquidación creada')
            invalidate()
        },
    })

    return {
        savePayroll: savePayroll.mutateAsync,
        isSaving: savePayroll.isPending,
    }
}
