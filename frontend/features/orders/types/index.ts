import { Contact, ProductType } from "@/types/entities"
import { LucideIcon } from 'lucide-react'

export interface OrderLine {
    id: number
    product?: number
    product_name?: string
    product_type?: ProductType
    quantity: number | string
    quantity_received?: number | string
    quantity_delivered?: number | string
    price_unit: number | string
    subtotal: number | string
    is_manufacturable?: boolean
    requires_advanced_manufacturing?: boolean
    work_order_summary?: any // TODO: Define WorkOrderSummary if needed
}

export interface Payment {
    id: number | string
    payment_method_display?: string
    method?: string
    transaction_number?: string
    payment_type?: string
    amount: number | string
    date?: string
    status?: string
}

export interface WorkOrder {
    id: number | string
    display_id?: string
    status: string
    production_progress?: number
    product_name?: string
    quantity?: number | string
}

export interface RelatedDocuments {
    invoices?: any[]
    payments?: Payment[]
    deliveries?: any[]
    receipts?: any[]
    receptions?: any[]
    work_orders?: WorkOrder[]
    returns?: any[]
    stock_moves?: any[]
    notes?: any[]
}

export interface PhaseDocument {
    id: number | string
    number: string
    type: string
    docType: string
    status?: string
    isWarning?: boolean
    disabled?: boolean
    actions?: {
        icon: LucideIcon
        title: string
        color?: string
        isPrimary?: boolean
        onClick: () => void
    }[]
}

export interface Order {
    id: number
    number: string
    status: string
    date?: string
    total: number | string
    pending_amount: number
    customer?: Contact | { id: number; name: string; credit_balance?: number }
    supplier?: Contact | { id: number; name: string }
    customer_name?: string | { id: number; name: string; credit_balance?: number }
    supplier_name?: string
    customer_id?: number
    supplier_id?: number
    sale_order?: any // Recursive or related
    purchase_order?: any
    lines?: OrderLine[]
    items?: OrderLine[] 
    related_documents?: RelatedDocuments
    invoices?: Order[]
    delivery_status?: string
    receiving_status?: string
    dte_type?: string
    document_type?: string
    work_orders?: WorkOrder[]
    serialized_payments?: Payment[]
    related_returns?: any[]
    related_stock_moves?: any[]
    corrected_invoice?: Order
    partner_name?: string
    name?: string
    effective_total?: number | string
    pos_session?: number | string
    balance?: number | string
    folio?: string
}
