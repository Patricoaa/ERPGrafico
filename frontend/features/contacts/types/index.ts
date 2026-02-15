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
}

export interface ContactFilters {
    name?: string
    tax_id?: string
    code?: string
    contact_type?: string
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
}

export interface InsightsData {
    sales: {
        count: number
        orders: any[]
    }
    purchases: {
        count: number
        orders: any[]
    }
    work_orders: {
        count: number
        orders: any[]
    }
}
