import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useRealtime } from '@/features/realtime'

export interface Warehouse {
    id: number
    name: string
    code: string
    address: string
}

export type WarehousePayload = Omit<Warehouse, 'id'>

// ─── Hierarchical query keys ──────────────────────────────────────────────────

export const WAREHOUSES_KEYS = {
    all: ['warehouses'] as const,
    lists: () => [...WAREHOUSES_KEYS.all, 'list'] as const,
    list: () => [...WAREHOUSES_KEYS.lists()] as const,
    details: () => [...WAREHOUSES_KEYS.all, 'detail'] as const,
    detail: (id: number) => [...WAREHOUSES_KEYS.details(), id] as const,
}

/** @deprecated Use WAREHOUSES_KEYS.* factory instead. */
export const WAREHOUSES_QUERY_KEY = WAREHOUSES_KEYS.all

// ─── Hook principal ──────────────────────────────────────────────────────────

export function useWarehouses() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: warehouses, isLoading, refetch } = useQuery({
        queryKey: WAREHOUSES_KEYS.list(),
        queryFn: async (): Promise<Warehouse[]> => {
            const response = await api.get<Warehouse[]>('/inventory/warehouses/')
            return response.data
        },
        staleTime: 15 * 60 * 1000, // 15 min — datos de configuración
    })

    const invalidate = () => {
        // Cubre lista, detalle y cualquier sub-recurso futuro de warehouses.
        queryClient.invalidateQueries({ queryKey: WAREHOUSES_KEYS.all })
    }

    const saveWarehouseMutation = useMutation({
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

    const deleteWarehouseMutation = useMutation({
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
        warehouses: warehouses ?? [],
        isLoading,
        refetch,
        saveWarehouse: saveWarehouseMutation.mutateAsync,
        isSaving: saveWarehouseMutation.isPending,
        deleteWarehouse: deleteWarehouseMutation.mutateAsync,
        isDeleting: deleteWarehouseMutation.isPending,
    }
}

/**
 * Fetch a single warehouse by id. Returns null while loading or when id is null.
 */
export function useWarehouse(id: number | null | undefined) {
    return useQuery({
        queryKey: id ? WAREHOUSES_KEYS.detail(id) : ['warehouses', 'detail', 'noop'],
        queryFn: async (): Promise<Warehouse> => {
            const res = await api.get<Warehouse>(`/inventory/warehouses/${id!}/`)
            return res.data
        },
        enabled: !!id,
    })
}
