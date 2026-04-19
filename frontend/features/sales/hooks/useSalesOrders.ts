import { showApiError } from "@/lib/errors"
import { useQueryClient, useMutation, useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { salesApi } from '../api/salesApi'
import { toast } from 'sonner'
import { SaleOrderFilters, SaleOrderPayload } from '../types'

const SALES_KEYS = {
    all: ['sales'] as const,
    orders: (filters: SaleOrderFilters) => [...SALES_KEYS.all, 'orders', { filters }] as const,
    notes: (filters: SaleOrderFilters) => [...SALES_KEYS.all, 'notes', { filters }] as const,
    order: (id: number) => [...SALES_KEYS.all, 'order', id] as const,
}

export function useSalesOrders({ filters }: { filters?: SaleOrderFilters } = {}) {
    const queryClient = useQueryClient()

    const { data: orders, refetch } = useSuspenseQuery({
        queryKey: SALES_KEYS.orders(filters || {}),
        queryFn: () => salesApi.getOrders(filters),
    })

    const createMutation = useMutation({
        mutationFn: salesApi.createOrder,
        onSuccess: () => {
            toast.success('Nota de venta creada')
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
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
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
        },
        onError: (error: Error) => {
            showApiError(error, 'Error al actualizar la nota de venta')
        }
    })

    const deleteMutation = useMutation({
        mutationFn: salesApi.deleteOrder,
        onSuccess: () => {
            toast.success('Nota de venta eliminada')
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
        },
        onError: (error: Error) => {
            toast.error('Error al eliminar')
        }
    })

    return {
        orders,
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
    // Using useQuery since notes are in a separate tab and might not need suspense immediately if lazy loaded, 
    // but consistency suggests useSuspenseQuery if we want suspense fallback.
    // However, SalesOrdersView uses tabs. If we use suspense, switching tabs will suspend.
    // Let's use useQuery for now to match current behavior or useSuspenseQuery if we wrap tabs in Suspense.
    // Current behavior in view: `useEffect` fetches based on tab.
    // We can use `useSuspenseQuery` and let the parent handle suspense, or use `useQuery` with `enabled`.
    // Given the goal of "Suspense-First", let's try `useSuspenseQuery` but maybe checking if we are in that view mode?
    // Actually, if we use `useSuspenseQuery` it will fetch immediately.
    // Let's use `useQuery` to allow manual fetching or enabled flag?
    // No, the goal is to remove manual fetching.
    // If we use separate components for each tab, we can use suspense in each.

    return useQuery({
        queryKey: SALES_KEYS.notes(filters || {}),
        queryFn: () => salesApi.getSalesNotes(filters),
    })
}
