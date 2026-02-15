import { Invoice } from "@/features/billing/types"

export interface SaleOrder {
    id: number
    number: string
    customer_name: string
    date: string
    status: string
    total: string
    total_paid: number
    pending_amount: number
    customer: number
    channel_display: string
    delivery_status: 'PENDING' | 'PARTIAL' | 'DELIVERED'
    has_pending_work_orders?: boolean
    related_documents?: {
        invoices: Invoice[]
        notes: Invoice[]
        payments: any[]
        deliveries: any[]
    }
    lines?: any[]
    pos_session_display?: string
    pos_session?: number
}

export interface SaleOrderFilters {
    status?: string
    customer_name?: string
    date_after?: string
    date_before?: string
    pos_session?: number
}

export interface SaleOrderPayload {
    customer: number
    date: string
    lines: {
        product: number
        quantity: number
        unit_price: number
    }[]
    // Add other fields as necessary
}
