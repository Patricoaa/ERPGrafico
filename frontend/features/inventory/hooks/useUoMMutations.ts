"use client"

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { UOMS_KEYS, UOM_CATEGORIES_KEYS } from './useUoMs'
import { useRealtime } from '@/features/realtime'
import type { UoM, UoMCategory, UoMCategoryPayload } from './useUoMs'

export function useUoMMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const deleteUoM = useMutation({
        mutationFn: async (id: number) => api.delete(`/inventory/uoms/${id}/`),
        onSuccess: () => {
            markLocalMutation()
            queryClient.invalidateQueries({ queryKey: UOMS_KEYS.all })
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
            queryClient.invalidateQueries({ queryKey: UOMS_KEYS.all })
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
            queryClient.invalidateQueries({ queryKey: UOM_CATEGORIES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: UOMS_KEYS.all })
        },
    })

    const deleteUoMCategory = useMutation({
        mutationFn: async (id: number) => api.delete(`/inventory/uom-categories/${id}/`),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Categoría eliminada')
            queryClient.invalidateQueries({ queryKey: UOM_CATEGORIES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: UOMS_KEYS.all })
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
