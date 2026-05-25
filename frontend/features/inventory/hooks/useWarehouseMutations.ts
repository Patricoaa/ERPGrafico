"use client"

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { WAREHOUSES_KEYS } from './useWarehouses'
import { useRealtime } from '@/features/realtime'
import type { Warehouse, WarehousePayload } from './useWarehouses'

export function useWarehouseMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: WAREHOUSES_KEYS.all })
    }

    const saveWarehouse = useMutation({
        mutationFn: async ({ id, payload }: { id: number | null, payload: WarehousePayload }) => {
            const res = id !== null
                ? await api.put<Warehouse>(`/inventory/warehouses/${id}/`, payload)
                : await api.post<Warehouse>('/inventory/warehouses/', payload)
            return res.data
        },
        onSuccess: (_, vars) => {
            markLocalMutation()
            toast.success(vars.id === null ? 'Bodega creada' : 'Bodega actualizada')
            invalidate()
        },
    })

    const deleteWarehouse = useMutation({
        mutationFn: async (id: number) => api.delete(`/inventory/warehouses/${id}/`),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Bodega eliminada')
            invalidate()
        },
        onError: (e: Error) => {
            toast.error(`Error al eliminar la bodega: ${e.message}`)
        },
    })

    return {
        saveWarehouse: saveWarehouse.mutateAsync,
        isSaving: saveWarehouse.isPending,
        deleteWarehouse: deleteWarehouse.mutateAsync,
        isDeleting: deleteWarehouse.isPending,
    }
}
