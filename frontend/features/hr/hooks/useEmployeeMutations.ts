"use client"

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createEmployee, updateEmployee, deleteEmployee } from '../api/hrApi'
import { toast } from 'sonner'
import { useRealtime } from '@/features/realtime'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { EMPLOYEES_QUERY_KEY } from './useEmployees'
import type { Employee } from '@/types/hr'

export function useEmployeeMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const invalidate = () => {
        invalidateCrossFeature(queryClient, [EMPLOYEES_QUERY_KEY])
    }

    const saveEmployee = useMutation({
        mutationFn: async ({ id, payload }: { id: number | null, payload: Partial<Employee> }) => {
            if (id !== null) {
                return await updateEmployee(id, payload)
            } else {
                return await createEmployee(payload)
            }
        },
        onSuccess: (_, vars) => {
            markLocalMutation()
            // toast success is handled in the component for now, or we can move it here. Let's keep it here for consistency
            toast.success(vars.id === null ? 'Empleado creado' : 'Empleado actualizado')
            invalidate()
        },
    })

    const removeEmployee = useMutation({
        mutationFn: async (id: number) => await deleteEmployee(id),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Empleado eliminado')
            invalidate()
        },
        onError: (e: Error) => {
            toast.error(`Error al eliminar empleado: ${e.message}`)
        }
    })

    return {
        saveEmployee: saveEmployee.mutateAsync,
        isSaving: saveEmployee.isPending,
        deleteEmployee: removeEmployee.mutateAsync,
        isDeleting: removeEmployee.isPending,
    }
}
