import api from '@/lib/api'
import type { Invoice, InvoiceFilters, AnnulInvoicePayload } from '../types'

/**
 * Centralized API service for billing operations
 */
export const billingApi = {
    /**
     * Fetch invoices with optional filtering
     */
    getInvoices: async (filters?: InvoiceFilters): Promise<Invoice[]> => {
        const params = new URLSearchParams()
        if (filters?.partner_name) params.append('partner_name', filters.partner_name)
        if (filters?.status) params.append('status', filters.status)
        if (filters?.dte_type) params.append('dte_type', filters.dte_type)

        const { data } = await api.get<{ results: Invoice[] }>('/billing/invoices/', { params })
        let invoices = data.results || data

        // Client-side filtering if needed (mirroring previous logic for safety, though API should handle most)
        // Previous logic filtered by sale_order OR dte_type in ['FACTURA', 'BOLETA']
        // We might want to move this to the backend or keep it here if the endpoint returns mixed types
        invoices = (invoices as any[]).filter((i: any) =>
            i.sale_order ||
            ['FACTURA', 'BOLETA'].includes(i.dte_type)
        )

        return invoices as Invoice[]
    },

    /**
     * Annul an invoice
     */
    annulInvoice: async (id: number, payload: AnnulInvoicePayload): Promise<void> => {
        await api.post(`/billing/invoices/${id}/annul/`, payload)
    },
}
