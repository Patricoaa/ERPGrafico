import { Contact, Warehouse, ProductMinimal } from "@/types/entities"

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
}

export interface PurchaseOrderAPI {
    id: number
    number: string
    display_id: string
    supplier: number | Contact
    warehouse: number | Warehouse | null
    status: string
    status_display: string
    total: string
    notes: string
    lines: PurchaseOrderLineAPI[]
}

export interface PartialReceiptLine {
    lineId?: number | string
    productId?: number | string
    productName?: string
    orderedQty: number
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
    transactionNumber: string
    treasuryAccountId: number | null
    isPending: boolean
}

export interface ReceiptData {
    type: 'IMMEDIATE' | 'LATER' | 'PARTIAL'
    deliveryReference: string
    notes: string
    partialQuantities: Array<{
        lineId: number
        productId: number
        receivedQty: number
        uom: string | number
    }>
    warehouseId?: string
}
