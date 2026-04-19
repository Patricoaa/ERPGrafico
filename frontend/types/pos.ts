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
    qty_reserved?: number
    qty_available?: number
    manufacturable_quantity?: number | null
    product_type?: 'STORABLE' | 'CONSUMABLE' | 'SERVICE' | 'MANUFACTURABLE' | 'SUBSCRIPTION'
    track_inventory?: boolean
    variants_count?: number
    has_variants?: boolean
    image?: string | null
    requires_advanced_manufacturing?: boolean
    mfg_auto_finalize?: boolean
    is_dynamic_pricing?: boolean
    is_favorite?: boolean
    has_bom?: boolean
    category?: {
        id: number
        name: string
        icon?: string | null
    } | number
    uom?: number
    sale_uom?: number
    uom_name?: string
    allowed_sale_uoms?: number[]
    // Variant fields
    variant_display_name?: string
    attribute_values_data?: {
        id: number
        attribute_name: string
        value: string
    }[]
    sale_price?: string | number
    sale_price_gross?: string | number
    qty_available?: number
    current_stock?: number
    qty_reserved?: number
    manufacturable_quantity?: number | null
    has_active_bom?: boolean
    product_type?: string
    requires_advanced_manufacturing?: boolean
    boms?: BOM[]
}

export type Variant = Product;

export interface Category {
    id: number
    name: string
    icon?: string | null
}

export interface Customer {
    id: number
    name: string
    full_name?: string
    tax_id?: string
    email?: string
    phone?: string
    address?: string
    is_default_customer?: boolean
}

export interface DTEData {
    type: 'FACTURA' | 'BOLETA' | 'GUIA_DESPACHO' | 'NOTA_CREDITO' | 'NOTA_DEBITO' | string
    number: string
    date: string
    attachment?: string | null
    isPending?: boolean
}

export interface PaymentData {
    method: 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT' | string
    amount: number
    transaction_number?: string
    details?: Record<string, unknown>
}

export interface DeliveryData {
    type: 'IMMEDIATE' | 'SCHEDULED' | 'PICKUP' | string
    date?: string | null
    notes?: string
}

export interface WizardState {
    step: number
    dteData?: DTEData
    paymentData?: PaymentData
    deliveryData?: DeliveryData
    approvalTaskId?: number | null
    isWaitingApproval?: boolean
    isApproved?: boolean
    isLoading?: boolean
    isQuickSale?: boolean
    selectedCustomerName?: string
    selectedCustomerId?: string | number
    isWaitingPayment?: boolean
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
    manufacturing_data?: unknown
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

export interface POSTerminal {
    id: number
    name: string
    code: string
    location: string
    is_active: boolean
    default_treasury_account: number
    default_treasury_account_name: string
    default_treasury_account_balance: number
    allowed_payment_methods: string[]
}

export interface POSSession {
    id: number
    terminal: number
    terminal_name?: string
    terminal_details?: {
        id: number
        name: string
        payment_terminal_device?: number
        payment_terminal_device_name?: string
    } | null
    treasury_account: number
    treasury_account_name: string
    user: number
    user_name: string
    status: 'OPEN' | 'CLOSED'
    status_display: string
    opened_at: string
    closed_at?: string | null
    opening_balance: number
    total_cash_sales: number
    total_card_sales: number
    total_transfer_sales: number
    total_credit_sales: number
    expected_cash: number
    total_other_cash_inflow: number
    total_other_cash_outflow: number
    cash_movements?: Record<string, unknown>[]
    sales_by_category?: Array<{ name: string; value: number }>
}

export interface POSSessionAudit {
    id: number
    session: number
    expected_amount: number | string
    actual_amount: number | string
    difference: number | string
    notes: string
    created_at: string
}

export interface AccountingSettings {
    id: number
    pos_partner_withdrawal_account?: number
    pos_theft_account?: number
    pos_rounding_adjustment_account?: number
}

export interface TreasuryAccount {
    id: number
    name: string
    code: string
    current_balance: number
    account_type: string
    active: boolean
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
