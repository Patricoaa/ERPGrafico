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
        // partner_name no tiene campo directo en filterset → usar search=
        if (filters?.partner_name) params.append('search', filters.partner_name)

        const { data } = await api.get<{ results: Invoice[]; count: number }>('/billing/invoices/', { params })
        return (data.results ?? (data as unknown as Invoice[])) as Invoice[]
    },

    /**
     * Annul an invoice
     */
    annulInvoice: async (id: number, payload: AnnulInvoicePayload): Promise<void> => {
        await api.post(`/billing/invoices/${id}/annul/`, payload)
    },
}
