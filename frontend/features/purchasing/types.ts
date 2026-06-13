import {Contact, Warehouse} from "@/types/entities"

export interface PurchaseOrderLineAPI {
    id: number
    product: number
    product_name: string
    quantity: string | number
    unit_cost: string | number
    uom: number
    uom_name: string
    tax_rate: string | number
    product_type?: string
    quantity_received?: number
    quantity_pending?: number
    subtotal?: number
    track_inventory?: boolean
}

export interface InvoiceDetail {
    id: number
    dte_type: string
    number: string
    document_attachment: string | null
}

export interface PurchaseOrderAPI {
    id: number
    number: string
    display_id: string
    supplier: number | Contact
    supplier_name: string
    warehouse: number | Warehouse | null
    warehouse_name: string | null
    status: string
    status_display: string
    receiving_status: "PENDING" | "PARTIAL" | "RECEIVED"
    total: string
    total_net: string
    total_tax: string
    total_paid: number
    pending_amount: number
    is_invoiced: boolean
    invoice_details: InvoiceDetail | null
    date: string
    receipt_date: string | null
    actual_receipt_date: string | null
    created_at: string
    updated_at: string
    notes: string
    supplier_reference?: string
    payment_method?: string
    lines: PurchaseOrderLineAPI[]
    work_order?: number | null
    work_order_number?: string | null
}

export interface PartialReceiptLine {
    lineId?: number | string
    productId?: number | string
    productName?: string
    orderedQty?: number
    receivedQty: number
    uom: number | string
}

export interface PartialReceiptLine {
    lineId?: number | string
    productId?: number | string
    productName?: string
    orderedQty?: number
    receivedQty: number
    uom: number | string
}

export interface PurchaseNoteLine {
    id?: number | string
    product: number | string
    product_name: string
    product_code?: string
    uom_name?: string
    quantity: number
    unit_cost: number
    note_quantity: number
    note_unit_cost: number
}

export interface CheckoutLine {
    id?: number
    product: string | number
    product_name: string
    quantity: number
    qty?: number // for legacy support in some steps
    unit_cost: number
    uom: string | number
    uom_name: string
    tax_rate: number
    product_type?: string
    name?: string // for display in summary
    receiving_warehouse?: string | number
    description?: string
}

export interface DTEData {
    type: string
    number: string
    date: string
    attachment: File | null
    isPending: boolean
}

export interface PaymentData {
    method: string
    amount: number
    treasuryAccountId: number | null
    isPending: boolean
    checkNumber?: string
}

export interface ReceiptData {
    type: 'IMMEDIATE' | 'LATER' | 'PARTIAL' | 'DEFERRED'
    deliveryReference: string
    notes: string
    partialQuantities: Array<{
        lineId?: number | string
        productId: number | string
        receivedQty: number
        uom: string | number
        orderedQty?: number
        productName?: string
    }>
    warehouseId?: string
    subscriptionDates?: Record<string, string>
}
