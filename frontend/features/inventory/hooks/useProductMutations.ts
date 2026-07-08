"use client"

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { inventoryApi } from '../api/inventoryApi'
import { useRealtime } from '@/features/realtime'
import { invalidateCrossFeature } from '@/lib/invalidation'
import type { ProductUpdatePayload } from '../types'
import { BOMS_QUERY_KEY, PRODUCTS_KEYS, VARIANTS_QUERY_KEY } from './queryKeys'

export function useProductMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const invalidateProducts = () => {
        invalidateCrossFeature(queryClient, [PRODUCTS_KEYS.all, BOMS_QUERY_KEY, VARIANTS_QUERY_KEY])
    }

    const updateProduct = useMutation({
        mutationFn: async ({ id, payload }: { id: number, payload: ProductUpdatePayload }) =>
            inventoryApi.updateProduct(id, payload),
        onSuccess: () => {
            markLocalMutation()
            invalidateProducts()
        },
    })

    const saveProduct = useMutation({
        mutationFn: async ({ id, payload }: { id: number | null, payload: ProductUpdatePayload | FormData }) =>
            inventoryApi.saveProduct(id, payload),
        onSuccess: (_, vars) => {
            markLocalMutation()
            toast.success(vars.id === null ? 'Producto creado' : 'Producto actualizado')
            invalidateProducts()
        },
    })

    const deleteProduct = useMutation({
        mutationFn: async (id: number) => inventoryApi.deleteProduct(id),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Producto eliminado')
            invalidateProducts()
        },
        onError: (e: Error) => {
            toast.error(`Error al eliminar el producto: ${e.message}`)
        },
    })

    const generateVariants = useMutation({
        mutationFn: async ({ templateId, selection }: {
            templateId: number
            selection: Array<{ attribute: number, values: number[] }>
        }) => inventoryApi.generateVariants(templateId, selection),
        onSuccess: () => {
            markLocalMutation()
            invalidateProducts()
        },
    })

    return {
        updateProduct: updateProduct.mutateAsync,
        isUpdating: updateProduct.isPending,
        saveProduct: saveProduct.mutateAsync,
        isSaving: saveProduct.isPending,
        deleteProduct: deleteProduct.mutateAsync,
        isDeleting: deleteProduct.isPending,
        generateVariants: generateVariants.mutateAsync,
        isGeneratingVariants: generateVariants.isPending,
    }
}
