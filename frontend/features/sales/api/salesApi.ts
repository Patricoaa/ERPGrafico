import api from '@/lib/api'
import type { SaleOrder, SaleOrderFilters, SaleOrderPayload, SaleNote } from '../types'
import { Invoice } from '@/features/billing/types'

/**
 * Centralized API service for sales operations
 */
export const salesApi = {
    /**
     * Fetch all sales orders
     */
    getOrders: async (filters?: SaleOrderFilters): Promise<SaleOrder[]> => {
        const params = new URLSearchParams()
        if (filters?.status) params.append('status', filters.status)
        if (filters?.customer_name) params.append('customer_name', filters.customer_name)
        if (filters?.date_after) params.append('date_after', filters.date_after)
        if (filters?.date_before) params.append('date_before', filters.date_before)
        if (filters?.pos_session) params.append('pos_session', String(filters.pos_session))

        const { data } = await api.get<SaleOrder[]>('/sales/orders/', { params })
        return data
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
    getSalesNotes: async (filters?: { date_after?: string, date_before?: string, customer_name?: string }): Promise<SaleNote[]> => {
        const params = new URLSearchParams()
        params.append('dte_type__in', 'NOTA_CREDITO,NOTA_DEBITO')
        params.append('sale_order__isnull', 'true') // Actually false in logic: sale_order__isnull=false means it HAS a sale order. In Django filter: sale_order__isnull=false. 
        // Wait, the original code used params object: { sale_order__isnull: false }
        // api.get handles boolean to string conversion usually? Or maybe I should send 'false'.
        // Let's verify original code.

        if (filters?.date_after) params.append('date_after', filters.date_after)
        if (filters?.date_before) params.append('date_before', filters.date_before)

        // We need to pass sale_order__isnull=false. 
        // If I use params.append('sale_order__isnull', 'false'), it might work depending on backend.
        // Original code:
        /*
            const response = await api.get('/billing/invoices/', {
                params: {
                    dte_type__in: 'NOTA_CREDITO,NOTA_DEBITO',
                    sale_order__isnull: false
                }
            })
        */
        // I will replicate this.

        const { data } = await api.get<Invoice[]>('/billing/invoices/', {
            params: {
                dte_type__in: 'NOTA_CREDITO,NOTA_DEBITO',
                sale_order__isnull: false,
                ...filters
            }
        })

        const results = data
        // Client-side filtering was also done in original code:
        /*
             const salesNotes = results.filter((inv: Invoice) =>
                 ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type) && inv.sale_order
             )
        */
        // The server filter `sale_order__isnull=false` should handle `inv.sale_order`.
        // `dte_type__in` handles the type.
        // So results should be correct.

        return results
    }
}
