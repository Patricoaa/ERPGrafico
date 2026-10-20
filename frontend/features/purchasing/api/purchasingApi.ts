import api from '@/lib/api'
import type {
    PurchaseOrderAPI,
} from '../types'
import type { Invoice } from '@/features/billing'
import { toPage } from '@/lib/pagination'
import type { Page, PageParams } from '@/lib/pagination'

export interface OrderFilters extends PageParams {
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
    created_at_after?: string
    created_at_before?: string
    ordering?: string
}

/** Filters shared by the order list and its analytics (same filtered set). */
function orderListParams(filters?: OrderFilters): URLSearchParams {
    const params = new URLSearchParams()
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
    if (filters?.created_at_after) params.append('created_at_after', filters.created_at_after)
    if (filters?.created_at_before) params.append('created_at_before', filters.created_at_before)
    return params
}

type Ranked = { id: string; value: number }[]
type ProductTotal = { product: string; total: number }

/** Response of `GET /purchasing/orders/analytics/` (backend `purchasing/analytics.py`). */
export interface PurchaseOrderAnalyticsResponse {
    granularity: 'day' | 'month' | 'year'
    totals: {
        total_volume: number
        order_count: number
        overdue_count: number
        pending_receipt_count: number
        on_time_count: number
        late_count: number
        total_line_volume: number
    }
    /** Axis funnel (ADR-0084) over non-cancelled orders; stage ids DRAFT · CONFIRMED · RECEIVED · INVOICED · PAID. */
    funnel: Ranked
    /** Labelled by `TreasuryMovement.Method` choices. */
    payment_method: Ranked
    top_suppliers: { supplier: string; total: number; order_count: number }[]
    /** Chronological; `bucket` is the first day of the period (ISO). */
    periods: { bucket: string; total: number; count: number }[]
    warehouses: { warehouse: string; count: number }[]
    top_products: ProductTotal[]
    product_types: Ranked
    dte: Ranked
    invoiced: { invoiced_count: number; invoiced_volume: number; pending_volume: number }
    by_type: Record<'storable' | 'service' | 'subscription', {
        top_products: (ProductTotal & { count: number })[]
        periods: { bucket: string; total: number }[]
        categories: Ranked
        total_volume: number
        order_count: number
    }>
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
        const params = orderListParams(filters)
        if (filters?.page) params.append('page', String(filters.page))
        if (filters?.page_size) params.append('page_size', String(filters.page_size))
        if (filters?.ordering) params.append('ordering', filters.ordering)
        const { data } = await api.get<unknown>('/purchasing/orders/', { params })
        return toPage<PurchaseOrderAPI>(data, filters?.page ?? 1, filters?.page_size ?? 50)
    },

    /** Analytics over the whole filtered order list (same filters as `getOrders`, no paging). */
    getOrderAnalytics: async (filters: OrderFilters | undefined, granularity: string): Promise<PurchaseOrderAnalyticsResponse> => {
        const params = orderListParams(filters)
        params.append('granularity', granularity)
        const { data } = await api.get<PurchaseOrderAnalyticsResponse>('/purchasing/orders/analytics/', { params })
        return data
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

    /** Credit/debit notes of purchase orders; `filters` are the `/billing/invoices/` params of the search bar. */
    getNotes: async ({ filters, page = 1, page_size = 50 }: { filters?: Record<string, string> } & PageParams = {}): Promise<Page<Invoice>> => {
        const params = new URLSearchParams(filters)
        params.append('page', String(page))
        params.append('page_size', String(page_size))
        params.append('dte_type__in', 'NOTA_CREDITO,NOTA_DEBITO')
        params.append('purchase_order__isnull', 'false')
        const { data } = await api.get<unknown>('/billing/invoices/', { params })
        return toPage<Invoice>(data, page, page_size)
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
        const res = await api.get<{ results: Record<string, unknown>[] }>('/inventory/products/?can_be_purchased=true&page_size=200')
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
        if (filters?.ordering) params.append('ordering', String(filters.ordering))
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

    /**
     * Fetch purchase returns (paginated, standalone list) — ADR-0090.
     * `filters` match `PurchaseReturnFilter` (status, date_after/before, supplier_name, purchase_order_number, warehouse_id).
     */
    getReturnsPaginated: async (filters?: Record<string, unknown>): Promise<Page<Record<string, unknown>>> => {
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
        if (filters?.ordering) params.append('ordering', String(filters.ordering))
        const res = await api.get('/purchasing/returns/', { params })
        return toPage<Record<string, unknown>>(res.data, page, page_size)
    },
}
