"use client"

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createEmployee, updateEmployee, archiveEmployee } from '../api/hrApi'
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

    const archive = useMutation({
        mutationFn: async ({ id, is_active, end_date }: { id: number, is_active: boolean, end_date?: string }) => await archiveEmployee(id, is_active, end_date),
        onSuccess: (_, vars) => {
            markLocalMutation()
            toast.success(vars.is_active ? 'Empleado restaurado' : 'Empleado archivado')
            invalidate()
        },
        onError: (e: Error) => {
            toast.error(`No se pudo actualizar el empleado: ${e.message}`)
        }
    })

    return {
        saveEmployee: saveEmployee.mutateAsync,
        isSaving: saveEmployee.isPending,
        archiveEmployee: archive.mutateAsync,
        isArchiving: archive.isPending,
    }
}
