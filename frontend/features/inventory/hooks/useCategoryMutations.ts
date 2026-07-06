"use client"

import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useRealtime } from '@/features/realtime'
import { invalidateCrossFeature } from '@/lib/invalidation'

import { CATEGORIES_KEYS, type Category } from './useCategories'

export function useCategoryMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const invalidate = () => {
        invalidateCrossFeature(queryClient, [CATEGORIES_KEYS.all])
    }

    const saveCategory = useMutation({
        mutationFn: async ({ id, payload }: { id: number | null, payload: Record<string, unknown> | FormData }) => {
            const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData
            const config = isFormData
                ? { headers: { 'Content-Type': 'multipart/form-data' as const } }
                : undefined
            const res = id !== null
                ? await api.put<Category>(`/inventory/categories/${id}/`, payload, config)
                : await api.post<Category>('/inventory/categories/', payload, config)
            return res.data
        },
        onSuccess: (_, vars) => {
            markLocalMutation()
            toast.success(vars.id === null ? 'Categoría creada' : 'Categoría actualizada')
            invalidate()
        },
    })

    const deleteCategory = useMutation({
        mutationFn: async (id: number) => api.delete(`/inventory/categories/${id}/`),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Categoría eliminada')
            invalidate()
        },
        onError: (e: Error) => {
            toast.error(`Error al eliminar la categoría: ${e.message}`)
        },
    })

    return {
        saveCategory: saveCategory.mutateAsync,
        isSaving: saveCategory.isPending,
        deleteCategory: deleteCategory.mutateAsync,
        isDeleting: deleteCategory.isPending,
    }
}
