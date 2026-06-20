import api from '@/lib/api'
import type { Invoice, InvoiceFilters, AnnulInvoicePayload } from '../types'

/**
 * Centralized API service for billing operations
 */
export const billingApi = {
    /**
     * Fetch invoices with optional filtering.
     *
     * The `mode` field is resolved server-side:
     *  - 'sale'     → sale_order__isnull=false   (documentos de venta)
     *  - 'purchase' → purchase_order__isnull=false (documentos de compra)
     *
     * Elimina el .filter() client-side que descartaba la mitad de un dataset
     * completo después de haberlo descargado. El backend ya soporta estos
     * filtros vía filterset_fields: { sale_order: ['isnull'], purchase_order: ['isnull'] }.
     */
    getInvoices: async (filters?: InvoiceFilters): Promise<Invoice[]> => {
        const params = new URLSearchParams()

        // Mode → server-side filter (era client-side anteriormente)
        if (filters?.mode === 'purchase') {
            params.append('purchase_order__isnull', 'false')
        } else if (filters?.mode === 'sale' || !filters?.mode) {
            // Por defecto: documentos de venta
            params.append('sale_order__isnull', 'false')
        }

        if (filters?.status)       params.append('status', filters.status)
        if (filters?.dte_type)     params.append('dte_type', filters.dte_type)
        if (filters?.date_from)    params.append('date_from', filters.date_from)
        if (filters?.date_to)      params.append('date_to', filters.date_to)
        if (filters?.total_min)    params.append('total_min', filters.total_min)
        if (filters?.total_max)    params.append('total_max', filters.total_max)
        if (filters?.number)       params.append('number', filters.number)
        // partner_name no tiene campo directo en filterset → usar search=
        if (filters?.partner_name) params.append('search', filters.partner_name)
        if (filters?.search) params.append('search', filters.search)

        const { data } = await api.get<Invoice[]>('/billing/invoices/', { params })
        return data
    },

    /**
     * Annul an invoice
     */
    annulInvoice: async (id: number, payload: AnnulInvoicePayload): Promise<void> => {
        await api.post(`/billing/invoices/${id}/annul/`, payload)
    },

    /**
     * Confirm (emit/finalize) a draft invoice. Acepta FormData porque el
     * flujo de completion permite adjuntar archivos (proof, payment receipt).
     */
    confirmInvoice: async (id: number, payload: FormData | Record<string, unknown>): Promise<Invoice> => {
        const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData
        const config = isFormData
            ? { headers: { 'Content-Type': 'multipart/form-data' as const } }
            : undefined
        const { data } = await api.post<Invoice>(`/billing/invoices/${id}/confirm/`, payload, config)
        return data
    },

    /** Fetch a single invoice by id. */
    getInvoice: async (id: number): Promise<Invoice> => {
        const { data } = await api.get<Invoice>(`/billing/invoices/${id}/`)
        return data
    },

    /**
     * Registra una nota (crédito/débito) asociada a la factura.
     * Acepta FormData porque el adjunto del documento es obligatorio.
     */
    registerNoteOnInvoice: async (invoiceId: number, payload: FormData): Promise<Invoice> => {
        const { data } = await api.post<Invoice>(`/billing/invoices/${invoiceId}/register_note/`, payload, {
            headers: { 'Content-Type': 'multipart/form-data' as const },
        })
        return data
    },

    /**
     * Checkout completo del wizard de venta — crea Invoice + SaleOrder.
     * Genérico en el response porque la respuesta del backend incluye
     * referencias a múltiples entidades creadas (invoice, order, payment, etc).
     */
    posCheckout: async <T = unknown>(payload: FormData): Promise<T> => {
        const { data } = await api.post<T>('/billing/invoices/pos_checkout/', payload, {
            headers: { 'Content-Type': 'multipart/form-data' as const },
        })
        return data
    },

    /**
     * Pide aprobación de crédito para una venta — abre un workflow.Task
     * que el supervisor debe aprobar antes de confirmar la factura.
     */
    requestCredit: async <T = unknown>(payload: FormData): Promise<T> => {
        const { data } = await api.post<T>('/billing/invoices/request_credit/', payload, {
            headers: { 'Content-Type': 'multipart/form-data' as const },
        })
        return data
    },

    cancelInvoice: async (id: number, reason: string = ''): Promise<void> => {
        await api.post(`/billing/invoices/${id}/cancel/`, { reason })
    },

    createPayment: async (formData: FormData): Promise<void> => {
        await api.post('/treasury/payments/', formData)
    },

    noteWorkflowCheckout: async (formData: FormData): Promise<void> => {
        await api.post('/billing/note-workflows/checkout/', formData)
    },

    completeNoteWorkflow: async (id: number): Promise<Record<string, unknown>> => {
        const { data } = await api.post<Record<string, unknown>>(`/billing/note-workflows/${id}/complete/`)
        return data
    },

    getWarehouses: async (): Promise<Record<string, unknown>[]> => {
        const res = await api.get<Record<string, unknown>[]>('/inventory/warehouses/')
        return res.data
    },

    getAllowedUoms: async (productId: string | number, context: string): Promise<Record<string, unknown>[]> => {
        const res = await api.get(`/inventory/uoms/allowed/?product_id=${productId}&context=${context}`)
        return res.data
    },
}
