import api from '@/lib/api'
import type { SaleOrder, SaleOrderFilters, SaleOrderPayload, SaleNote } from '../types'
import type { SaleNoteFilters } from '../hooks/useSalesOrders'
import { type Invoice } from '@/features/billing'
import { toPage, type Page } from '@/lib/pagination'

/**
 * Centralized API service for sales operations
 */
export const salesApi = {
    /**
     * Fetch all sales orders
     */
    getOrders: async (filters?: SaleOrderFilters): Promise<Page<SaleOrder>> => {
        const params = new URLSearchParams()
        if (filters?.page) params.append('page', String(filters.page))
        if (filters?.page_size) params.append('page_size', String(filters.page_size))
        if (filters?.customer_name) params.append('customer_name', filters.customer_name)
        if (filters?.date_after) params.append('date_after', filters.date_after)
        if (filters?.date_before) params.append('date_before', filters.date_before)
        if (filters?.total_min) params.append('total_min', filters.total_min)
        if (filters?.total_max) params.append('total_max', filters.total_max)
        if (filters?.number) params.append('number', filters.number)
        if (filters?.product_name) params.append('product_name', filters.product_name)
        if (filters?.delivery_status) params.append('delivery_status', filters.delivery_status)
        if (filters?.origin_status) params.append('origin_status', filters.origin_status)
        if (filters?.billing_status) params.append('billing_status', filters.billing_status)
        if (filters?.payment_status) params.append('payment_status', filters.payment_status)
        if (filters?.production_status) params.append('production_status', filters.production_status)
        if (filters?.pos_session) params.append('pos_session', String(filters.pos_session))
        if (filters?.search) params.append('search', filters.search)

        const { data } = await api.get('/sales/orders/', { params })
        return toPage<SaleOrder>(data, filters?.page ?? 1, filters?.page_size ?? 50)
    },

    /**
     * Fetch a single sale order
     */
    getOrder: async (id: number): Promise<SaleOrder> => {
        const { data } = await api.get<SaleOrder>(`/sales/orders/${id}/`)
        return data
    },

    /**
     * Create a new sale order
     */
    createOrder: async (payload: SaleOrderPayload): Promise<SaleOrder> => {
        const { data } = await api.post<SaleOrder>('/sales/orders/', payload)
        return data
    },

    /**
     * Update an existing sale order
     */
    updateOrder: async (id: number, payload: Partial<SaleOrderPayload>): Promise<SaleOrder> => {
        const { data } = await api.patch<SaleOrder>(`/sales/orders/${id}/`, payload)
        return data
    },

    /**
     * Delete a sale order
     */
    deleteOrder: async (id: number): Promise<void> => {
        await api.delete(`/sales/orders/${id}/`)
    },

    /**
     * Despacha (cierra logística) una orden de venta completa.
     */
    dispatchOrder: async (orderId: number, payload: { warehouse_id: number, delivery_date: string }): Promise<void> => {
        await api.post(`/sales/orders/${orderId}/dispatch/`, payload)
    },

    /**
     * Despacho parcial — entrega solo las cantidades especificadas en
     * `line_quantities` (lineId → qty). El resto queda pendiente.
     */
    dispatchOrderPartial: async (
        orderId: number,
        payload: { warehouse_id: number, delivery_date: string, line_quantities: Record<string, number> },
    ): Promise<void> => {
        await api.post(`/sales/orders/${orderId}/partial_dispatch/`, payload)
    },

    /**
     * Register a note (credit/debit) directly on a sale order.
     * El backend acepta FormData porque el adjunto del documento es obligatorio.
     */
    registerNoteOnOrder: async (orderId: number, payload: FormData): Promise<SaleOrder> => {
        const { data } = await api.post<SaleOrder>(`/sales/orders/${orderId}/register_note/`, payload, {
            headers: { 'Content-Type': 'multipart/form-data' as const },
        })
        return data
    },

    /**
     * Fetch sales notes (credit/debit notes associated with orders)
     */
    getSalesNotes: async (filters?: SaleNoteFilters): Promise<Page<SaleNote>> => {
        const params = new URLSearchParams()
        if (filters?.page) params.append('page', String(filters.page))
        if (filters?.page_size) params.append('page_size', String(filters.page_size))
        if (filters?.customer_name) params.append('customer_name', filters.customer_name)
        if (filters?.date_after) params.append('date_after', filters.date_after)
        if (filters?.date_before) params.append('date_before', filters.date_before)
        if (filters?.total_min) params.append('total_min', filters.total_min)
        if (filters?.total_max) params.append('total_max', filters.total_max)
        if (filters?.number) params.append('number', filters.number)
        if (filters?.status) params.append('status', filters.status)
        params.append('dte_type__in', 'NOTA_CREDITO,NOTA_DEBITO')
        params.append('sale_order__isnull', 'false')

        const { data } = await api.get<{ results: Invoice[] }>('/billing/invoices/', { params })

        return toPage<SaleNote>(data, filters?.page ?? 1, filters?.page_size ?? 50)
    }
}
