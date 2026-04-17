import { Invoice } from "@/features/billing/types"

export type SaleOrderStatus = 'DRAFT' | 'OPEN' | 'CANCELLED' | 'COMPLETED' | 'PAID' | 'PARTIAL'
export type DeliveryStatus = 'PENDING' | 'PARTIAL' | 'DELIVERED'

export interface SaleOrderLine {
    id?: number
    product?: string | number
    product_name?: string
    description: string
    quantity: number
    uom: string | number
    uom_name?: string
    unit_price: number
    unit_price_net?: number
    unit_price_gross?: number
    tax_rate: number
    total_gross?: number
    discount_amount?: number
    discount_percentage?: number
    custom_specs?: Record<string, any>
    manufacturing_data?: any
    product_type?: string
    requires_advanced_manufacturing?: boolean
    has_bom?: boolean
    mfg_enable_prepress?: boolean
    mfg_enable_press?: boolean
    mfg_enable_postpress?: boolean
    mfg_prepress_design?: boolean
    mfg_prepress_folio?: boolean
    mfg_press_offset?: boolean
    mfg_press_digital?: boolean
    mfg_press_special?: boolean
    mfg_auto_finalize?: boolean
    // Inventory and Dispatch fields
    qty?: number
    qty_available?: number
    manufacturable_quantity?: number
    track_inventory?: boolean
    internal_code?: string
    code?: string
}

export interface SaleOrder {
    id: number
    number: string
    customer_name: string
    date: string
    status: SaleOrderStatus | string
    total: string | number
    total_paid: number
    pending_amount: number
    customer: number
    channel_display: string
    delivery_status: DeliveryStatus
    has_pending_work_orders?: boolean
    related_documents?: {
        invoices: Invoice[]
        notes: Invoice[]
        payments: any[]
        deliveries: any[]
    }
    lines?: SaleOrderLine[]
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
    customer: number | null
    payment_method?: string
    channel?: string
    total_discount_amount?: number
    date: string
    lines: Partial<SaleOrderLine>[]
}

// Checkout Wizard Types
export interface CheckoutDTEData {
    type: string
    number: string
    date: string
    attachment: File | null
    isPending: boolean
}

export interface CheckoutPaymentData {
    method: string | null
    amount: number
    transactionNumber: string
    treasuryAccountId: number | null
    isPending: boolean
    paymentMethodId?: number
    /** true cuando el método es CARD_TERMINAL — activa flujo TUU automatizado */
    isTerminalIntegration?: boolean
}

export interface CheckoutDeliveryData {
    type: 'IMMEDIATE' | 'SCHEDULED' | 'PARTIAL'
    date: string | null
    notes: string
    partialQuantities?: Array<{
        lineId: number
        productId: number
        dispatchedQty: number
        uom: string | number
    }>
}
