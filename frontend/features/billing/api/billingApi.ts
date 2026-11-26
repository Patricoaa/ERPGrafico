import { toServerGroups, type ServerGroup } from '@/lib/server-groups'
import api from '@/lib/api'
import { toPage } from '@/lib/pagination'
import type { Page } from '@/lib/pagination'
import type { Invoice, InvoiceFilters, AnnulInvoicePayload, InvoiceableLinesParams, InvoiceableOrder, InvoiceFromLinesPayload } from '../types'
import { invoiceableOrderSchema } from '../types'

const INVOICE_FILTERS = ['status', 'dte_type', 'contact', 'date_from', 'date_to', 'total_min', 'total_max', 'number', 'partner_name', 'search', 'payment_status', 'ordering'] as const

/** List params of the invoices of one side (`mode`, default sale): shared by the rows and their groups. */
function invoiceListParams(filters?: InvoiceFilters): URLSearchParams {
    const params = new URLSearchParams()
    // Mode → server-side filter (era client-side anteriormente); por defecto, documentos de venta.
    if (filters?.mode === 'purchase') params.append('purchase_order__isnull', 'false')
    else params.append('sale_order__isnull', 'false')
    for (const key of INVOICE_FILTERS) {
        const value = filters?.[key]
        if (value) params.append(key, String(value))
    }
    return params
}

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
    getInvoices: async (filters?: InvoiceFilters): Promise<Page<Invoice>> => {
        const { page = 1, page_size = 20 } = filters ?? {}
        const params = invoiceListParams(filters)
        params.append('page', String(page))
        params.append('page_size', String(page_size))
        const { data } = await api.get<unknown>('/billing/invoices/', { params })
        return toPage<Invoice>(data, page, page_size)
    },

    /** Groups of the filtered invoice list (ADR-0158 §7), with the same sale / purchase split. */
    getInvoiceGroups: async (filters: InvoiceFilters, groupBy: string): Promise<ServerGroup[]> => {
        const params = invoiceListParams(filters)
        params.append('group_by', groupBy)
        const { data } = await api.get<unknown>('/billing/invoices/groups/', { params })
        return toServerGroups(data)
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
    posCheckout: async <T = unknown>(payload: FormData, idempotencyKey?: string): Promise<T> => {
        const headers: Record<string, string> = { 'Content-Type': 'multipart/form-data' as const }
        if (idempotencyKey) {
            headers['Idempotency-Key'] = idempotencyKey
        }
        const { data } = await api.post<T>('/billing/invoices/pos_checkout/', payload, { headers })
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
        // eslint-disable-next-line pagination/no-raw-response-data -- master data, no pagination
        return res.data
    },

    getAllowedUoms: async (productId: string | number, context: string): Promise<Record<string, unknown>[]> => {
        const res = await api.get(`/inventory/uoms/allowed/?product_id=${productId}&context=${context}`)
        // eslint-disable-next-line pagination/no-raw-response-data -- custom @action, not paginated
        return res.data
    },

    /** Líneas pendientes de facturar con sus entregas (ADR-0081). */
    getInvoiceableLines: async (params: InvoiceableLinesParams): Promise<InvoiceableOrder[]> => {
        const { data } = await api.get<unknown>('/billing/invoices/invoiceable-lines/', {
            params: {
                side: params.side,
                ...(params.partner ? { partner: params.partner } : {}),
                ...(params.orders?.length ? { orders: params.orders.join(',') } : {}),
            },
        })
        return invoiceableOrderSchema.array().parse(data)
    },

    /** Factura parcial / multi-orden por cantidad (ADR-0081). Requiere Idempotency-Key. */
    createInvoiceFromLines: async (payload: InvoiceFromLinesPayload, idempotencyKey: string): Promise<Invoice> => {
        const { data } = await api.post<Invoice>('/billing/invoices/from-lines/', payload, {
            headers: { 'Idempotency-Key': idempotencyKey },
        })
        return data
    },
}
