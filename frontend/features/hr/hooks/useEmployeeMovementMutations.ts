"use client"

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
    allocateMovement, annulEmployeeMovement, createEmployeeMovement, deallocateMovement,
    deleteEmployeeMovement, previewLoanSchedule, updateEmployeeMovement,
} from '../api/hrApi'
import { useRealtime } from '@/features/realtime'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { EMPLOYEE_MOVEMENTS_QUERY_KEY } from './useEmployeeMovements'
import type { LoanSchedulePreviewRequest } from '@/types/hr'

export function useEmployeeMovementMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const invalidate = () => {
        invalidateCrossFeature(queryClient, [
            EMPLOYEE_MOVEMENTS_QUERY_KEY,
            ['hr', 'payrolls'],
            ['hr', 'employees'],
            ['documents', 'relations'],
        ])
    }
    const done = (message: string) => () => {
        markLocalMutation()
        toast.success(message)
        invalidate()
    }

    const save = useMutation({
        mutationFn: ({ id, payload }: { id: number | null; payload: Record<string, unknown> }) =>
            id === null ? createEmployeeMovement(payload) : updateEmployeeMovement(id, payload),
        onSuccess: (_, vars) => done(vars.id === null ? 'Movimiento registrado' : 'Movimiento actualizado')(),
    })
    const remove = useMutation({ mutationFn: deleteEmployeeMovement, onSuccess: done('Movimiento eliminado') })
    const annul = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason: string }) => annulEmployeeMovement(id, reason),
        onSuccess: done('Movimiento anulado'),
    })
    const allocate = useMutation({
        mutationFn: ({ id, payroll, amount }: { id: number; payroll: number; amount?: string }) =>
            allocateMovement(id, { payroll, amount }),
        onSuccess: done('Asignado a la liquidación'),
    })
    const deallocate = useMutation({
        mutationFn: ({ id, allocationId }: { id: number; allocationId: number }) => deallocateMovement(id, allocationId),
        onSuccess: done('Asignación retirada'),
    })
    const preview = useMutation({ mutationFn: (body: LoanSchedulePreviewRequest) => previewLoanSchedule(body) })

    return {
        createMovement: save.mutateAsync,
        isSaving: save.isPending,
        deleteMovement: remove.mutateAsync,
        isDeleting: remove.isPending,
        annulMovement: annul.mutateAsync,
        isAnnulling: annul.isPending,
        allocate: allocate.mutateAsync,
        deallocate: deallocate.mutateAsync,
        previewSchedule: preview.mutateAsync,
        isPreviewing: preview.isPending,
    }
}
