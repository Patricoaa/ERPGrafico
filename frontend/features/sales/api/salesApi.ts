import { toServerGroups, type ServerGroup } from '@/lib/server-groups'
import api from '@/lib/api'
import type { SaleOrder, SaleOrderFilters, SaleOrderPayload, SaleNote } from '../types'
import type { SaleNoteFilters } from '../hooks/useSalesOrders'
import { type Invoice } from '@/features/billing'
import { toPage } from '@/lib/pagination'
import type {Page} from '@/lib/pagination'

/** Filters shared by the order list and its analytics (same filtered set). */
function orderListParams(filters?: SaleOrderFilters): URLSearchParams {
    const params = new URLSearchParams()
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
    for (const key of ['date', 'customer', 'status', 'channel'] as const) {
        const value = filters?.[key]
        if (value) params.append(key, value)
    }
    return params
}

/** Response of `GET /sales/orders/analytics/` (backend `sales/analytics.py`). */
export interface SaleOrderAnalyticsResponse {
    granularity: "day" | "month" | "year"
    totals: {
        total_volume: number
        total_paid: number
        total_pending: number
        order_count: number
        avg_order_value: number
        customer_count: number
        delivered_count: number
        pending_delivery_count: number
        pos_order_count: number
        system_order_count: number
    }
    trend: Record<"current" | "previous", { volume: number; paid: number; count: number }>
    channel: { id: string; value: number }[]
    payment_method: { id: string; value: number }[]
    delivery_status: { id: string; value: number }[]
    customers: { customer: string; total: number; order_count: number }[]
    products: { product: string; total: number; count: number }[]
    product_types: { id: string; value: number }[]
    /** Chronological; `bucket` is the first day of the period (ISO). */
    periods: { bucket: string; total: number; count: number; net: number; system: number; pos: number; delivered: number }[]
    price_ranges: { id: string; value: number }[]
}

/**
 * Centralized API service for sales operations
 */
/** List filters forwarded by `getDeliveriesPaginated` and its groups (customer / supplier id: server grouping). */
const DELIVERY_FILTERS = ['status', 'date_after', 'date_before', 'customer_name', 'customer_id', 'sale_order_number', 'warehouse_id', 'search', 'note_type', 'ordering'] as const

/** List filters forwarded by `getReturnsPaginated` and its groups (customer / supplier id: server grouping). */
const RETURN_FILTERS = ['status', 'date_after', 'date_before', 'customer_name', 'customer_id', 'sale_order_number', 'warehouse_id', 'search', 'ordering'] as const

/** Appends the truthy `keys` of `filters` (plus page / page_size) as list params. */
function listParams(filters: Record<string, unknown> | undefined, keys: readonly string[]): URLSearchParams {
    const params = new URLSearchParams()
    for (const key of ['page', 'page_size', ...keys]) {
        const value = filters?.[key]
        if (value) params.append(key, String(value))
    }
    return params
}

export const salesApi = {
    /**
     * Fetch all sales orders
     */
    /** Groups of the filtered order list (ADR-0158 §7): count, total and the params of each group's rows. */
    getOrderGroups: async (filters: SaleOrderFilters, groupBy: string): Promise<ServerGroup[]> => {
        const params = orderListParams(filters)
        params.append('group_by', groupBy)
        if (filters.ordering) params.append('ordering', filters.ordering)
        const { data } = await api.get<unknown>('/sales/orders/groups/', { params })
        return toServerGroups(data)
    },

    getOrders: async (filters?: SaleOrderFilters): Promise<Page<SaleOrder>> => {
        const params = orderListParams(filters)
        if (filters?.page) params.append('page', String(filters.page))
        if (filters?.page_size) params.append('page_size', String(filters.page_size))
        if (filters?.ordering) params.append('ordering', filters.ordering)

        const { data } = await api.get<unknown>('/sales/orders/', { params })
        return toPage<SaleOrder>(data, filters?.page ?? 1, filters?.page_size ?? 50)
    },

    /**
     * Analytics over the whole filtered order list (same filters as `getOrders`, no paging).
     */
    getOrderAnalytics: async (filters: SaleOrderFilters | undefined, granularity: string): Promise<SaleOrderAnalyticsResponse> => {
        const params = orderListParams(filters)
        params.append('granularity', granularity)
        const { data } = await api.get<SaleOrderAnalyticsResponse>('/sales/orders/analytics/', { params })
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
     * Fetch deliveries (paginated, standalone list)
     */
    /** Deliveries grouped on the server (ADR-0158 §7): every group of the filtered list. */
    getDeliveryGroups: async (filters: Record<string, unknown>, groupBy: string): Promise<ServerGroup[]> => {
        const params = listParams(filters, DELIVERY_FILTERS)
        params.append('group_by', groupBy)
        const res = await api.get<unknown>('/sales/deliveries/groups/', { params })
        return toServerGroups(res.data)
    },

    getDeliveriesPaginated: async (filters?: Record<string, unknown>): Promise<Page<Record<string, unknown>>> => {
        const params = listParams(filters, DELIVERY_FILTERS)
        const page = Number(filters?.page ?? 1)
        const page_size = Number(filters?.page_size ?? 50)
        const { data } = await api.get<unknown>('/sales/deliveries/', { params })
        return toPage<Record<string, unknown>>(data, page, page_size)
    },

    /**
     * Fetch a single delivery by id
     */
    getDelivery: async (id: number): Promise<Record<string, unknown>> => {
        const { data } = await api.get<Record<string, unknown>>(`/sales/deliveries/${id}/`)
        return data
    },

    /**
     * Fetch a single sale return by id
     */
    getReturn: async (id: number): Promise<Record<string, unknown>> => {
        const { data } = await api.get<Record<string, unknown>>(`/sales/returns/${id}/`)
        return data
    },

    /**
     * Fetch returns (paginated, standalone list) — ADR-0090.
     * `filters` match `SaleReturnFilter` (status, date_after/before, customer_name, sale_order_number, warehouse_id).
     */
    /** Returns grouped on the server (ADR-0158 §7): every group of the filtered list. */
    getReturnGroups: async (filters: Record<string, unknown>, groupBy: string): Promise<ServerGroup[]> => {
        const params = listParams(filters, RETURN_FILTERS)
        params.append('group_by', groupBy)
        const res = await api.get<unknown>('/sales/returns/groups/', { params })
        return toServerGroups(res.data)
    },

    getReturnsPaginated: async (filters?: Record<string, unknown>): Promise<Page<Record<string, unknown>>> => {
        const params = listParams(filters, RETURN_FILTERS)
        const page = Number(filters?.page ?? 1)
        const page_size = Number(filters?.page_size ?? 50)
        const { data } = await api.get<unknown>('/sales/returns/', { params })
        return toPage<Record<string, unknown>>(data, page, page_size)
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
