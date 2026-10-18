import { type Contact, type ProductType } from "@/types/entities"
import { type LucideIcon } from 'lucide-react'

export interface WorkOrderSummary {
    id: number | string
    status: string
    production_progress?: number
    [key: string]: unknown
}

export interface InvoiceSummary {
    id: number | string
    number?: string
    status?: string
    [key: string]: unknown
}

export interface DeliverySummary {
    id: number | string
    status?: string
    [key: string]: unknown
}

export interface StockMoveSummary {
    id: number | string
    state?: string
    [key: string]: unknown
}

export interface NoteSummary {
    id: number | string
    number?: string
    status?: string
    [key: string]: unknown
}

export interface OrderLine {
    id: number
    product?: number
    product_name?: string
    description?: string
    uom_name?: string
    unit_name?: string
    product_type?: ProductType
    quantity: number | string
    quantity_received?: number | string
    quantity_delivered?: number | string
    quantity_invoiced?: number | string
    /** Pendiente de despachar/recibir, calculado por el backend. */
    quantity_pending?: number | string
    received_quantity?: number | string
    delivered_quantity?: number | string
    price_unit: number | string
    subtotal: number | string
    /** Neto por línea en documentos gross-first (OV): reparto exacto de total_net (ADR-0083). */
    subtotal_net?: number | string
    unit_price_net?: number | string
    unit_price?: number | string
    /** OC: costo unitario neto. */
    unit_cost?: number | string
    is_manufacturable?: boolean
    requires_advanced_manufacturing?: boolean
    is_production_finished?: boolean
    track_inventory?: boolean
    manufacturable_quantity?: number | null
    /** Stock disponible en la bodega elegida; no viene del backend, lo agrega el despacho al consultar la bodega. */
    available_stock?: number
    work_order_summary?: WorkOrderSummary
    [key: string]: unknown
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
    payment_method?: string
    display_id?: string
    reference?: string
    [key: string]: unknown
}

export interface WorkOrder {
    id: number | string
    display_id?: string
    status: string
    production_progress?: number
    product_name?: string
    quantity?: number | string
    code?: string
    current_stage?: string
    [key: string]: unknown
}

export interface Order {
    id: number
    display_id?: string
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
    sale_order?: Partial<Order> | number | string
    purchase_order?: Partial<Order> | number | string
    lines?: OrderLine[]
    items?: OrderLine[] 
    /** Resumen tipado (ADR-0083 U6): facturas, notas, despachos (OV) o recepciones (OC). */
    notes?: InvoiceSummary[]
    deliveries?: DeliverySummary[]
    receipts?: DeliverySummary[]
    /** Resumen tipado de facturas (ADR-0083 U6). */
    invoices?: InvoiceSummary[]
    delivery_status?: string
    receiving_status?: string
    dte_type?: string
    document_type?: string
    work_orders?: WorkOrder[]
    serialized_payments?: Payment[]
    corrected_invoice?: Order
    /** Documento de origen como DocumentRef (ADR-0086). */
    origin_document?: unknown | null
    dte_type_display?: string
    partner_name?: string
    name?: string
    effective_total?: number | string
    payment_status?: string
    is_quote?: boolean
    pos_session?: number | string
    balance?: number | string
    folio?: string
    production_progress?: number
    is_cancellable?: boolean
    warehouse_name?: string
    [key: string]: unknown
}
