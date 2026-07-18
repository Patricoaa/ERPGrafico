"use client"

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createAbsence, updateAbsence, deleteAbsence } from '../api/hrApi'
import { toast } from 'sonner'
import { useRealtime } from '@/features/realtime'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { ABSENCES_QUERY_KEY } from './useAbsences'
import type { Absence } from '@/types/hr'

export function useAbsenceMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const invalidate = () => {
        invalidateCrossFeature(queryClient, [ABSENCES_QUERY_KEY])
    }

    const saveAbsence = useMutation({
        mutationFn: async ({ id, payload }: { id: number | null, payload: Partial<Absence> }) => {
            if (id !== null) {
                return await updateAbsence(id, payload)
            } else {
                return await createAbsence(payload)
            }
        },
        onSuccess: (_, vars) => {
            markLocalMutation()
            toast.success(vars.id === null ? 'Inasistencia registrada' : 'Inasistencia actualizada')
            invalidate()
        },
    })

    const removeAbsence = useMutation({
        mutationFn: async (id: number) => await deleteAbsence(id),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Inasistencia eliminada')
            invalidate()
        },
        onError: (e: Error) => {
            toast.error(`Error al eliminar inasistencia: ${e.message}`)
        }
    })

    return {
        saveAbsence: saveAbsence.mutateAsync,
        isSaving: saveAbsence.isPending,
        deleteAbsence: removeAbsence.mutateAsync,
        isDeleting: removeAbsence.isPending,
    }
}
