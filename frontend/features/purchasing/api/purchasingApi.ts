import api from '@/lib/api'
import type {
    PurchaseOrderAPI,
    CheckoutLine,
    PurchaseNoteLine,
    DTEData,
    PaymentData,
    ReceiptData,
} from '../types'
import type { Invoice } from '@/features/billing/types'

interface OrderFilters {
    status?: string
    search?: string
    date_from?: string
    date_to?: string
}

interface CheckoutPayload {
    order_data: Record<string, unknown>
    dte_type: string
    document_number?: string
    document_date?: string
    is_pending_registration?: string
    payment_method?: string
    amount?: string
    payment_is_pending?: string
    transaction_number?: string
    treasury_account_id?: string
    payment_type?: string
    receipt_type?: string
    receipt_data?: string
}

interface NotePayload {
    note_type: string
    document_number: string
    document_date: string
    amount_net: string
    amount_tax: string
    return_items: string
    original_invoice_id?: string
    payment_data?: string
}

interface CreateInvoicePayload {
    order_id: string
    order_type: string
    dte_type: string
    supplier_invoice_number: string
    issue_date: string
    status: string
}

interface PartialReceivePayload {
    warehouse_id: number
    receipt_date: string
    delivery_reference: string
    notes: string
    line_data: Array<{
        line_id: number
        quantity: number
        unit_cost: number
    }>
}

export const purchasingApi = {
    // ========== Orders ==========

    getOrders: async (filters?: OrderFilters): Promise<PurchaseOrderAPI[]> => {
        const params = new URLSearchParams()
        if (filters?.status) params.append('status', filters.status)
        if (filters?.search) params.append('search', filters.search)
        if (filters?.date_from) params.append('date_after', filters.date_from)
        if (filters?.date_to) params.append('date_before', filters.date_to)
        const res = await api.get<PurchaseOrderAPI[]>('/purchasing/orders/', { params })
        return res.data
    },

    getOrder: async (id: number): Promise<PurchaseOrderAPI> => {
        const res = await api.get<PurchaseOrderAPI>(`/purchasing/orders/${id}/`)
        return res.data
    },

    createOrder: async (formData: FormData): Promise<void> => {
        await api.post('/purchasing/orders/purchase_checkout/', formData)
    },

    updateOrder: async (id: number, data: Record<string, unknown>): Promise<void> => {
        await api.put(`/purchasing/orders/${id}/`, data)
    },

    deleteOrder: async (id: number): Promise<void> => {
        await api.delete(`/purchasing/orders/${id}/`)
    },

    partialReceive: async (orderId: number, payload: PartialReceivePayload): Promise<void> => {
        await api.post(`/purchasing/orders/${orderId}/partial_receive/`, payload)
    },

    partialReturn: async (orderId: number, payload: PartialReceivePayload): Promise<void> => {
        await api.post(`/purchasing/orders/${orderId}/partial_return/`, payload)
    },

    registerNote: async (orderId: number, formData: FormData): Promise<void> => {
        await api.post(`/purchasing/orders/${orderId}/register_note/`, formData)
    },

    registerInvoiceNote: async (invoiceId: number, formData: FormData): Promise<void> => {
        await api.post(`/billing/invoices/${invoiceId}/register_note/`, formData)
    },

    // ========== Billing ==========

    getNotes: async (): Promise<Invoice[]> => {
        const response = await api.get<Invoice[]>('/billing/invoices/', {
            params: {
                dte_type__in: 'NOTA_CREDITO,NOTA_DEBITO',
                purchase_order__isnull: false
            }
        })
        return response.data
    },

    getInvoice: async (id: number): Promise<Invoice> => {
        const res = await api.get<Invoice>(`/billing/invoices/${id}/`)
        return res.data
    },

    createInvoiceFromOrder: async (formData: FormData): Promise<void> => {
        await api.post('/billing/invoices/create_from_order/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
    },

    // ========== Inventory ==========

    getPurchasableProducts: async (): Promise<Record<string, unknown>[]> => {
        const res = await api.get<Record<string, unknown>[]>('/inventory/products/?can_be_purchased=true')
        return res.data
    },

    getUoms: async (): Promise<Record<string, unknown>[]> => {
        const res = await api.get<Record<string, unknown>[]>('/inventory/uoms/')
        return res.data
    },

    getWarehouses: async (): Promise<Record<string, unknown>[]> => {
        const res = await api.get<Record<string, unknown>[]>('/inventory/warehouses/')
        return res.data
    },

    getWarehouse: async (id: string): Promise<Record<string, unknown>> => {
        const res = await api.get(`/inventory/warehouses/${id}/`)
        return res.data
    },

    // ========== Contacts ==========

    getDefaultSupplier: async (): Promise<Record<string, unknown>[]> => {
        const res = await api.get<Record<string, unknown>[]>('/contacts/?is_default_vendor=true')
        return res.data
    },

    // ========== Receipts ==========

    getReceipts: async (orderId?: number): Promise<Record<string, unknown>[]> => {
        const params = orderId ? { purchase_order: orderId } : {}
        const res = await api.get('/purchasing/receipts/', { params })
        return res.data.results ?? res.data
    },

    getReceipt: async (id: number): Promise<Record<string, unknown>> => {
        const res = await api.get(`/purchasing/receipts/${id}/`)
        return res.data
    },

    // ========== Returns ==========

    getReturns: async (orderId?: number): Promise<Record<string, unknown>[]> => {
        const params = orderId ? { purchase_order: orderId } : {}
        const res = await api.get('/purchasing/returns/', { params })
        return res.data.results ?? res.data
    },

    getReturn: async (id: number): Promise<Record<string, unknown>> => {
        const res = await api.get(`/purchasing/returns/${id}/`)
        return res.data
    },
}
