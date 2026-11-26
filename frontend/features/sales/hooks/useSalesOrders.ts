import { invalidateCrossFeature } from '@/lib/invalidation'
import {showApiError} from "@/lib/errors"
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { salesApi } from '../api/salesApi'
import { toast } from 'sonner'
import { type SaleOrderFilters, type SaleOrderPayload } from '../types'
import { useRealtime } from '@/features/realtime'

import { SALES_KEYS } from './queryKeys'
import { staleTime } from '@/lib/query-config'
import { getDomainConceptTitle } from '@/lib/entity-registry'

export { SALES_KEYS }

/** `enabled: false` while the list groups on the server (`useSaleOrderGroups` loads the rows per group). */
export function useSalesOrders({ filters, enabled = true }: { filters?: SaleOrderFilters; enabled?: boolean } = {}) {
    const queryClient = useQueryClient()
    const invalidateSales = () => invalidateCrossFeature(queryClient, [SALES_KEYS.all])
    const { markLocalMutation } = useRealtime()

    const { page = 1, page_size = 50, ...restFilters } = filters || {}
    const activeFilters = { page, page_size, ...restFilters }

    const query = useQuery({
        queryKey: SALES_KEYS.orders(activeFilters),
        queryFn: () => salesApi.getOrders(activeFilters),
        enabled,
        staleTime: staleTime.standard, // 2 min
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
            toast.success(`${getDomainConceptTitle('ov')} creada`)
            invalidateSales()
        },
        onError: (error: Error) => {
            showApiError(error, `Error al crear la ${getDomainConceptTitle('ov').toLowerCase()}`)
        }
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number, payload: Partial<SaleOrderPayload> }) =>
            salesApi.updateOrder(id, payload),
        onSuccess: () => {
            markLocalMutation()
            toast.success(`${getDomainConceptTitle('ov')} actualizada`)
            invalidateSales()
        },
        onError: (error: Error) => {
            showApiError(error, `Error al actualizar la ${getDomainConceptTitle('ov').toLowerCase()}`)
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
            invalidateSales()
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
            invalidateSales()
        },
    })

    const partialDispatchMutation = useMutation({
        mutationFn: ({ orderId, payload }: {
            orderId: number,
            payload: { warehouse_id: number, delivery_date: string, line_quantities: Record<string, number> },
        }) => salesApi.dispatchOrderPartial(orderId, payload),
        onSuccess: () => {
            markLocalMutation()
            invalidateSales()
        },
    })

    return {
        page: query.data,
        orders,
        isLoading: showSkeleton,
        isRefetching,
        /** The list failed to load (the error itself is reported by the API layer). */
        isError: query.isError,
        refetch,
        createOrder: createMutation.mutateAsync,
        updateOrder: updateMutation.mutateAsync,
        registerNoteOnOrder: registerNoteMutation.mutateAsync,
        dispatchOrder: dispatchMutation.mutateAsync,
        dispatchOrderPartial: partialDispatchMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isRegisteringNote: registerNoteMutation.isPending,
        isDispatching: dispatchMutation.isPending || partialDispatchMutation.isPending,
    }
}

/** Params of `InvoiceFilterSet` (the notes are invoices): `date_from` / `date_to` and `partner_name`. */
export interface SaleNoteFilters {
    page?: number
    page_size?: number
    date_from?: string
    date_to?: string
    partner_name?: string
    /** Contact id (server grouping by customer, ADR-0158 §7). */
    contact?: string
    search?: string
    payment_status?: string
    total_min?: string
    total_max?: string
    number?: string
    status?: string
    /** Several statuses, comma separated (`InvoiceFilterSet` `status__in`). */
    status__in?: string
}

export function useSalesNotes({ filters, enabled = true }: { filters?: SaleNoteFilters; enabled?: boolean } = {}) {
    const { page = 1, page_size = 50, ...restFilters } = filters || {}
    const activeFilters = { page, page_size, ...restFilters }

    const query = useQuery({
        queryKey: SALES_KEYS.notes(activeFilters),
        queryFn: () => salesApi.getSalesNotes(activeFilters),
        staleTime: staleTime.standard,
        enabled,
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
        isError: query.isError,
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
    const { data: saleOrder, isLoading, isError } = useQuery({
        queryKey: id ? SALES_KEYS.order(id) : ['sales', 'order', 'noop'],
        queryFn: () => salesApi.getOrder(id as number),
        staleTime: staleTime.standard,
        enabled: !!id,
    })
    return { saleOrder: saleOrder ?? null, isLoading, isError }
}
