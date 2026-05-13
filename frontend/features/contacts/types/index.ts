import { Order, WorkOrder } from "../../orders/types"
export interface Contact {
    id: number
    code: string | null
    display_id: string
    name: string
    tax_id: string | null
    contact_type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH' | 'RELATED' | 'OTHER'
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    payment_terms: string | null
    is_default_customer: boolean
    is_default_vendor: boolean

    credit_enabled?: boolean
    credit_limit?: number | null
    credit_days?: number | null
    credit_balance_used?: number | null
    credit_available?: number | null
    credit_blocked?: boolean
    credit_auto_blocked?: boolean
}

export interface ContactFilters {
    search?: string
    type?: string
    tax_id?: string
    code?: string
    is_default_customer?: boolean
    is_default_vendor?: boolean
}

export interface ContactPayload {
    name: string
    tax_id: string
    email?: string
    phone?: string
    address?: string
    city?: string
    payment_terms?: string
    is_default_customer: boolean
    is_default_vendor: boolean

    credit_enabled?: boolean
    credit_limit?: number | null
    credit_days?: number | null
}

export interface InsightsData {
    sales: {
        count: number
        orders: Order[]
    }
    purchases: {
        count: number
        orders: Order[]
    }
    work_orders: {
        count: number
        orders: WorkOrder[]
    }
}
