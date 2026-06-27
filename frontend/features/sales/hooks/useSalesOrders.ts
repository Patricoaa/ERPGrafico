import {showApiError} from "@/lib/errors"
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { salesApi } from '../api/salesApi'
import { toast } from 'sonner'
import { type SaleOrderFilters, type SaleOrderPayload, type SaleOrder } from '../types'
import { useRealtime } from '@/features/realtime'
import type { Page } from '@/lib/pagination'

import { SALES_KEYS } from './queryKeys'

export { SALES_KEYS }

export function useSalesOrders({ filters, initialData }: { filters?: SaleOrderFilters, initialData?: Page<SaleOrder> } = {}) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { page = 1, page_size = 50, ...restFilters } = filters || {}
    const activeFilters = { page, page_size, ...restFilters }

    const query = useQuery({
        queryKey: SALES_KEYS.orders(activeFilters),
        queryFn: () => salesApi.getOrders(activeFilters),
        staleTime: 2 * 60 * 1000, // 2 min
        initialData,
        placeholderData: (prev) => prev,
    })

    const orders = query.data?.results ?? []
    const showSkeleton = query.isLoading && !orders.length
    const isRefetching = query.isFetching && !showSkeleton
    const refetch = query.refetch

    const createMutation = useMutation({
        mutationFn: salesApi.createOrder,
        onSuccess: () => {
            markLocalMutation()
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
            markLocalMutation()
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
            markLocalMutation()
            toast.success('Nota de venta eliminada')
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
        },
        onError: (error: Error) => {
            toast.error('Error al eliminar')
        }
    })

    const registerNoteMutation = useMutation({
        mutationFn: ({ orderId, payload }: { orderId: number, payload: FormData }) =>
            salesApi.registerNoteOnOrder(orderId, payload),
        onSuccess: () => {
            markLocalMutation()
            // Una nota afecta el estado y los totales de la orden padre + crea
            // un invoice asociado → invalida sales completo. Billing también
            // debe refrescarse pero esa invalidación la dispara el bus o el
            // próximo useInvoices al volverse stale.
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
        },
    })

    const dispatchMutation = useMutation({
        mutationFn: ({ orderId, payload }: { orderId: number, payload: { warehouse_id: number, delivery_date: string } }) =>
            salesApi.dispatchOrder(orderId, payload),
        onSuccess: () => {
            markLocalMutation()
            // dispatch cambia el delivery_status de la orden y crea movimientos
            // de stock. Invalidamos sales (estado) y la query externa de stockMoves
            // se invalidará si el bus está habilitado.
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
        },
    })

    const partialDispatchMutation = useMutation({
        mutationFn: ({ orderId, payload }: {
            orderId: number,
            payload: { warehouse_id: number, delivery_date: string, line_quantities: Record<string, number> },
        }) => salesApi.dispatchOrderPartial(orderId, payload),
        onSuccess: () => {
            markLocalMutation()
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
        },
    })

    return {
        page: query.data,
        orders,
        isLoading: showSkeleton,
        isRefetching,
        refetch,
        createOrder: createMutation.mutateAsync,
        updateOrder: updateMutation.mutateAsync,
        deleteOrder: deleteMutation.mutateAsync,
        registerNoteOnOrder: registerNoteMutation.mutateAsync,
        dispatchOrder: dispatchMutation.mutateAsync,
        dispatchOrderPartial: partialDispatchMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
        isRegisteringNote: registerNoteMutation.isPending,
        isDispatching: dispatchMutation.isPending || partialDispatchMutation.isPending,
    }
}

export interface SaleNoteFilters {
    page?: number
    page_size?: number
    date_after?: string
    date_before?: string
    customer_name?: string
    total_min?: string
    total_max?: string
    number?: string
    status?: string
}

export function useSalesNotes({ filters }: { filters?: SaleNoteFilters } = {}) {
    const { page = 1, page_size = 50, ...restFilters } = filters || {}
    const activeFilters = { page, page_size, ...restFilters }

    const query = useQuery({
        queryKey: SALES_KEYS.notes(activeFilters),
        queryFn: () => salesApi.getSalesNotes(activeFilters),
        staleTime: 2 * 60 * 1000,
        placeholderData: (prev) => prev,
    })

    const notes = query.data?.results ?? []
    const showSkeleton = query.isLoading && !notes.length
    const isRefetching = query.isFetching && !showSkeleton

    return {
        page: query.data,
        notes,
        isLoading: showSkeleton,
        isRefetching,
        refetch: query.refetch,
    }
}

/**
 * Fetch a single sale order by id. queryKey alineada con SALES_KEYS.order(id)
 * para que las mutations que invalidan SALES_KEYS.all también refresquen el
 * detalle. Usada por SaleOrderDetailClient, DeliveryDetailClient y
 * SaleReturnDetailClient (las tres pantallas fetchean la misma orden padre).
 */
export function useSaleOrder(id: number | null | undefined) {
    return useQuery({
        queryKey: id ? SALES_KEYS.order(id) : ['sales', 'order', 'noop'],
        queryFn: () => salesApi.getOrder(id as number),
        staleTime: 2 * 60 * 1000,
        enabled: !!id,
    })
}
