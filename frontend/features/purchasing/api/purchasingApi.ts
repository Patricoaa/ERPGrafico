import api from '@/lib/api'
import type {
    PurchaseOrderAPI,
} from '../types'
import type { Invoice } from '@/features/billing'
import { toPage } from '@/lib/pagination'
import type { Page, PageParams } from '@/lib/pagination'

interface OrderFilters extends PageParams {
    status?: string
    search?: string
    date_from?: string
    date_to?: string
    date_after?: string
    date_before?: string
    receiving_status?: string
    receipt_date_after?: string
    receipt_date_before?: string
    total_min?: string
    total_max?: string
    origin_status?: string
    billing_status?: string
    treasury_status?: string
    supplier_name?: string
    number?: string
    product_name?: string
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

    getOrders: async (filters?: OrderFilters): Promise<Page<PurchaseOrderAPI>> => {
        const params = new URLSearchParams()
        if (filters?.page) params.append('page', String(filters.page))
        if (filters?.page_size) params.append('page_size', String(filters.page_size))
        if (filters?.status) params.append('status', filters.status)
        if (filters?.search) params.append('search', filters.search)
        if (filters?.date_from) params.append('date_after', filters.date_from)
        if (filters?.date_to) params.append('date_before', filters.date_to)
        if (filters?.date_after) params.append('date_after', filters.date_after)
        if (filters?.date_before) params.append('date_before', filters.date_before)
        if (filters?.receiving_status) params.append('receiving_status', filters.receiving_status)
        if (filters?.receipt_date_after) params.append('receipt_date_after', filters.receipt_date_after)
        if (filters?.receipt_date_before) params.append('receipt_date_before', filters.receipt_date_before)
        if (filters?.total_min) params.append('total_min', filters.total_min)
        if (filters?.total_max) params.append('total_max', filters.total_max)
        if (filters?.origin_status) params.append('origin_status', filters.origin_status)
        if (filters?.billing_status) params.append('billing_status', filters.billing_status)
        if (filters?.treasury_status) params.append('treasury_status', filters.treasury_status)
        if (filters?.supplier_name) params.append('supplier_name', filters.supplier_name)
        if (filters?.number) params.append('number', filters.number)
        if (filters?.product_name) params.append('product_name', filters.product_name)
        const res = await api.get('/purchasing/orders/', { params })
        return toPage<PurchaseOrderAPI>(res.data, filters?.page ?? 1, filters?.page_size ?? 50)
    },

    getOrder: async (id: number): Promise<PurchaseOrderAPI> => {
        const res = await api.get<PurchaseOrderAPI>(`/purchasing/orders/${id}/`)
        return res.data
    },

    createOrder: async (formData: FormData, idempotencyKey?: string): Promise<void> => {
        const headers: Record<string, string> = { 'Content-Type': 'multipart/form-data' }
        if (idempotencyKey) {
            headers['Idempotency-Key'] = idempotencyKey
        }
        await api.post('/purchasing/orders/purchase_checkout/', formData, { headers })
    },

    updateOrder: async (id: number, data: Record<string, unknown>): Promise<void> => {
        await api.put(`/purchasing/orders/${id}/`, data)
    },

    deleteOrder: async (id: number): Promise<void> => {
        await api.delete(`/purchasing/orders/${id}/`)
    },

    annulOrder: async (id: number, payload: { force: boolean, reason?: string }): Promise<void> => {
        await api.post(`/purchasing/orders/${id}/annul/`, payload)
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
        const response = await api.get<{ results: Invoice[] }>('/billing/invoices/', {
            params: {
                dte_type__in: 'NOTA_CREDITO,NOTA_DEBITO',
                purchase_order__isnull: false
            }
        })
        return response.data.results
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
        const res = await api.get<{ results: Record<string, unknown>[] }>('/inventory/products/?can_be_purchased=true')
        return res.data.results
    },

    getUoms: async (): Promise<Record<string, unknown>[]> => {
        const res = await api.get<Record<string, unknown>[]>('/inventory/uoms/')
        // eslint-disable-next-line pagination/no-raw-response-data -- master data, no pagination
        return res.data
    },

    getWarehouses: async (): Promise<Record<string, unknown>[]> => {
        const res = await api.get<Record<string, unknown>[]>('/inventory/warehouses/')
        // eslint-disable-next-line pagination/no-raw-response-data -- master data, no pagination
        return res.data
    },

    getWarehouse: async (id: string): Promise<Record<string, unknown>> => {
        const res = await api.get(`/inventory/warehouses/${id}/`)
        return res.data
    },

    // ========== Contacts ==========

    getDefaultSupplier: async (): Promise<Record<string, unknown>[]> => {
        const res = await api.get<{ results: Record<string, unknown>[] }>('/contacts/?is_default_vendor=true')
        return res.data.results
    },

    // ========== Receipts ==========

    getReceipts: async (orderId?: number): Promise<Record<string, unknown>[]> => {
        const params = orderId ? { purchase_order: orderId } : {}
        const res = await api.get('/purchasing/receipts/', { params })
        return res.data.results
    },

    getReceiptsPaginated: async (filters?: Record<string, unknown>): Promise<Page<Record<string, unknown>>> => {
        const params = new URLSearchParams()
        const page = Number(filters?.page ?? 1)
        const page_size = Number(filters?.page_size ?? 50)
        if (filters?.page) params.append('page', String(filters.page))
        if (filters?.page_size) params.append('page_size', String(filters.page_size))
        if (filters?.status) params.append('status', String(filters.status))
        if (filters?.date_after) params.append('date_after', String(filters.date_after))
        if (filters?.date_before) params.append('date_before', String(filters.date_before))
        if (filters?.supplier_name) params.append('supplier_name', String(filters.supplier_name))
        if (filters?.purchase_order_number) params.append('purchase_order_number', String(filters.purchase_order_number))
        if (filters?.warehouse_id) params.append('warehouse_id', String(filters.warehouse_id))
        if (filters?.search) params.append('search', String(filters.search))
        if (filters?.note_type) params.append('note_type', String(filters.note_type))
        const res = await api.get('/purchasing/receipts/', { params })
        return toPage<Record<string, unknown>>(res.data, page, page_size)
    },

    getReceipt: async (id: number): Promise<Record<string, unknown>> => {
        const res = await api.get(`/purchasing/receipts/${id}/`)
        return res.data
    },

    // ========== Returns ==========

    getReturns: async (orderId?: number): Promise<Record<string, unknown>[]> => {
        const params = orderId ? { purchase_order: orderId } : {}
        const res = await api.get('/purchasing/returns/', { params })
        return res.data.results
    },

    getReturn: async (id: number): Promise<Record<string, unknown>> => {
        const res = await api.get(`/purchasing/returns/${id}/`)
        return res.data
    },
}
