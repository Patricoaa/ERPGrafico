"use client"

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createAdvance, updateAdvance, deleteAdvance } from '../api/hrApi'
import { toast } from 'sonner'
import { useRealtime } from '@/features/realtime'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { SALARY_ADVANCES_QUERY_KEY } from './useSalaryAdvances'
import type { SalaryAdvance } from '@/types/hr'

export function useAdvanceMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const invalidate = () => {
        invalidateCrossFeature(queryClient, [SALARY_ADVANCES_QUERY_KEY])
    }

    const saveAdvance = useMutation({
        mutationFn: async ({ id, payload }: { id: number | null, payload: Partial<SalaryAdvance> }) => {
            if (id !== null) {
                return await updateAdvance(id, payload)
            } else {
                return await createAdvance(payload)
            }
        },
        onSuccess: (_, vars) => {
            markLocalMutation()
            toast.success(vars.id === null ? 'Anticipo registrado' : 'Anticipo actualizado')
            invalidate()
        },
    })

    const removeAdvance = useMutation({
        mutationFn: async (id: number) => await deleteAdvance(id),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Anticipo eliminado')
            invalidate()
        },
        onError: (e: Error) => {
            toast.error(`Error al eliminar anticipo: ${e.message}`)
        }
    })

    return {
        saveAdvance: saveAdvance.mutateAsync,
        isSaving: saveAdvance.isPending,
        deleteAdvance: removeAdvance.mutateAsync,
        isDeleting: removeAdvance.isPending,
    }
}
