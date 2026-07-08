"use client"

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { UOMS_KEYS, UOM_CATEGORIES_KEYS } from './useUoMs'
import { useRealtime } from '@/features/realtime'
import type { UoM, UoMCategory, UoMCategoryPayload } from './useUoMs'

export function useUoMMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const invalidateUoMs = () => invalidateCrossFeature(queryClient, [UOMS_KEYS.all])
    const invalidateUoMsAndCategories = () => invalidateCrossFeature(queryClient, [UOMS_KEYS.all, UOM_CATEGORIES_KEYS.all])

    const deleteUoM = useMutation({
        mutationFn: async (id: number) => api.delete(`/inventory/uoms/${id}/`),
        onSuccess: () => {
            markLocalMutation()
            invalidateUoMs()
        },
    })

    const saveUoM = useMutation({
        mutationFn: async (uom: Partial<UoM>) => {
            const res = uom.id
                ? await api.put<UoM>(`/inventory/uoms/${uom.id}/`, uom)
                : await api.post<UoM>('/inventory/uoms/', uom)
            return res.data
        },
        onSuccess: () => {
            markLocalMutation()
            invalidateUoMs()
        },
    })

    const saveUoMCategory = useMutation({
        mutationFn: async ({ id, payload }: { id: number | null, payload: UoMCategoryPayload }) => {
            const res = id !== null
                ? await api.put<UoMCategory>(`/inventory/uom-categories/${id}/`, payload)
                : await api.post<UoMCategory>('/inventory/uom-categories/', payload)
            return res.data
        },
        onSuccess: (_, vars) => {
            markLocalMutation()
            toast.success(vars.id === null ? 'Categoría creada' : 'Categoría actualizada')
            invalidateUoMsAndCategories()
        },
    })

    const deleteUoMCategory = useMutation({
        mutationFn: async (id: number) => api.delete(`/inventory/uom-categories/${id}/`),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Categoría eliminada')
            invalidateUoMsAndCategories()
        },
        onError: (e: Error) => {
            toast.error(`Error al eliminar la categoría: ${e.message}`)
        },
    })

    return {
        saveUoM: saveUoM.mutateAsync,
        isSaving: saveUoM.isPending,
        deleteUoM: deleteUoM.mutateAsync,
        saveUoMCategory: saveUoMCategory.mutateAsync,
        isSavingCategory: saveUoMCategory.isPending,
        deleteUoMCategory: deleteUoMCategory.mutateAsync,
    }
}
