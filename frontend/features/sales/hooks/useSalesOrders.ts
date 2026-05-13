import { showApiError } from "@/lib/errors"
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { salesApi } from '../api/salesApi'
import { toast } from 'sonner'
import { SaleOrderFilters, SaleOrderPayload } from '../types'

import { SALES_KEYS } from './queryKeys'

export { SALES_KEYS }

export function useSalesOrders({ filters }: { filters?: SaleOrderFilters } = {}) {
    const queryClient = useQueryClient()

    const { data: orders, isLoading, refetch } = useQuery({
        queryKey: SALES_KEYS.orders(filters || {}),
        queryFn: () => salesApi.getOrders(filters),
        staleTime: 2 * 60 * 1000, // 2 min
    })

    const createMutation = useMutation({
        mutationFn: salesApi.createOrder,
        onSuccess: () => {
            toast.success('Nota de venta creada')
            // Narrow: only orders list is stale after creating an order (not notes)
            queryClient.invalidateQueries({ queryKey: [...SALES_KEYS.all, 'orders'] })
        },
        onError: (error: Error) => {
            showApiError(error, 'Error al crear la nota de venta')
        }
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number, payload: Partial<SaleOrderPayload> }) =>
            salesApi.updateOrder(id, payload),
        onSuccess: () => {
            toast.success('Nota de venta actualizada')
            // Narrow: only orders list + invoices (order status may affect billing badge)
            queryClient.invalidateQueries({ queryKey: [...SALES_KEYS.all, 'orders'] })
        },
        onError: (error: Error) => {
            showApiError(error, 'Error al actualizar la nota de venta')
        }
    })

    const deleteMutation = useMutation({
        mutationFn: salesApi.deleteOrder,
        onSuccess: () => {
            toast.success('Nota de venta eliminada')
            // Narrow: only orders list is stale on delete
            queryClient.invalidateQueries({ queryKey: [...SALES_KEYS.all, 'orders'] })
        },
        onError: (error: Error) => {
            toast.error('Error al eliminar')
        }
    })

    return {
        orders: orders ?? [],
        isLoading,
        refetch,
        createOrder: createMutation.mutateAsync,
        updateOrder: updateMutation.mutateAsync,
        deleteOrder: deleteMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending
    }
}

export function useSalesNotes({ filters }: { filters?: { date_after?: string, date_before?: string } } = {}) {
    const { data, isLoading, refetch } = useQuery({
        queryKey: SALES_KEYS.notes(filters || {}),
        queryFn: () => salesApi.getSalesNotes(filters),
    })

    return { data: data ?? [], isLoading, refetch }
}
