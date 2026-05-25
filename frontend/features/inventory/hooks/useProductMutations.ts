"use client"

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { inventoryApi } from '../api/inventoryApi'
import { useRealtime } from '@/features/realtime'
import type { ProductUpdatePayload } from '../types'
import { BOMS_QUERY_KEY, PRODUCTS_KEYS } from './queryKeys'

export function useProductMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const invalidateProductsAndBoms = () => {
        queryClient.invalidateQueries({ queryKey: PRODUCTS_KEYS.all })
        queryClient.invalidateQueries({ queryKey: BOMS_QUERY_KEY })
    }

    const updateProduct = useMutation({
        mutationFn: async ({ id, payload }: { id: number, payload: ProductUpdatePayload }) =>
            inventoryApi.updateProduct(id, payload),
        onSuccess: () => {
            markLocalMutation()
            invalidateProductsAndBoms()
        },
    })

    const saveProduct = useMutation({
        mutationFn: async ({ id, payload }: { id: number | null, payload: ProductUpdatePayload | FormData }) =>
            inventoryApi.saveProduct(id, payload),
        onSuccess: (_, vars) => {
            markLocalMutation()
            toast.success(vars.id === null ? 'Producto creado' : 'Producto actualizado')
            invalidateProductsAndBoms()
        },
    })

    const deleteProduct = useMutation({
        mutationFn: async (id: number) => inventoryApi.deleteProduct(id),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Producto eliminado')
            invalidateProductsAndBoms()
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
            invalidateProductsAndBoms()
            queryClient.invalidateQueries({ queryKey: ['inventory', 'variants'] })
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
