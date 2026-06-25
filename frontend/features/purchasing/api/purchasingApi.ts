import api from '@/lib/api'
import type {
    PurchaseOrderAPI,
} from '../types'
import type { Invoice } from '@/features/billing/types'
import { toPage, type Page } from '@/lib/pagination'
import type { PageParams } from '@/lib/pagination'

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

    getReceipts: async (orderId?: number): Promise<Record<string, unknown>> => {
        const params = orderId ? { purchase_order: orderId } : {}
        const res = await api.get('/purchasing/receipts/', { params })
        return res.data
    },

    getReceipt: async (id: number): Promise<Record<string, unknown>> => {
        const res = await api.get(`/purchasing/receipts/${id}/`)
        return res.data
    },

    // ========== Returns ==========

    getReturns: async (orderId?: number): Promise<Record<string, unknown>> => {
        const params = orderId ? { purchase_order: orderId } : {}
        const res = await api.get('/purchasing/returns/', { params })
        return res.data
    },

    getReturn: async (id: number): Promise<Record<string, unknown>> => {
        const res = await api.get(`/purchasing/returns/${id}/`)
        return res.data
    },
}
