// POS Type Definitions
// Centralized TypeScript types for the POS system

export interface Product {
    id: number
    code: string
    internal_code?: string
    name: string
    sale_price: string
    sale_price_gross: string
    current_stock?: number
    manufacturable_quantity?: number | null
    product_type?: 'STORABLE' | 'CONSUMABLE' | 'SERVICE' | 'MANUFACTURABLE' | 'SUBSCRIPTION'
    variants_count?: number
    has_variants?: boolean
    image?: string | null
    requires_advanced_manufacturing?: boolean
    is_dynamic_pricing?: boolean
    has_bom?: boolean
    category?: {
        id: number
        name: string
        icon?: string | null
    } | number
    uom?: number
    uom_name?: string
    allowed_sale_uoms?: number[]
}

export interface Category {
    id: number
    name: string
    icon?: string | null
}

export interface Customer {
    id: number
    name: string
}

export interface CartItem extends Product {
    cartItemId: string
    qty: number
    total_net: number
    total_gross: number
    unit_price_net: number
    unit_price_gross: number
    discount_percentage?: number
    discount_amount?: number
    uom?: number
    manufacturing_data?: any
    uom_name?: string
}

export interface BOMLine {
    id: number
    component: number
    quantity: number
    uom: number | null
}

export interface BOM {
    id: number
    product: number
    lines: BOMLine[]
    active: boolean
}

export interface UoM {
    id: number
    name: string
    category: number
    ratio: string
}

export interface POSSession {
    id: number
    terminal: number
    terminal_name?: string
    treasury_account: number
    treasury_account_name: string
    user: number
    user_name: string
    status: 'OPEN' | 'CLOSED'
    status_display: string
    opened_at: string
    opening_balance: number
    total_cash_sales: number
    total_card_sales: number
    total_transfer_sales: number
    total_credit_sales: number
    expected_cash: number
    total_other_cash_inflow: number
    total_other_cash_outflow: number
    cash_movements?: any[]
}

export interface StockLimits {
    [key: string]: number // Keyed by `cart_${cartItemId}` or `prod_${productId}`
}

export interface ComponentCache {
    [componentId: number]: {
        stock: number
        uom: number
    }
}

export interface BOMCache {
    [productId: number]: BOM
}

export interface DraftCart {
    id: number
    name: string
    items: CartItem[]
    customer_id?: number
    created_at: string
    updated_at: string
}
