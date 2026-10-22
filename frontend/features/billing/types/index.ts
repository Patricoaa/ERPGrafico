/** Eje de pago derivado del saldo (ADR-0084); no es un estado del documento. */
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID'

export interface Invoice {
    id: number
    display_id?: string
    number: string | null
    date: string
    due_date?: string
    dte_type: 'FACTURA' | 'BOLETA' | 'NOTA_CREDITO' | 'NOTA_DEBITO' | 'GUIA_DESPACHO' | 'FACTURA_EXENTA' | 'BOLETA_EXENTA'
    dte_type_display: string
    partner_name: string
    /** RUT de la contraparte al emitir (copia fiscal); en borradores, el actual */
    partner_tax_id?: string
    sale_order: number | null
    sale_order_number: string | null
    total: string
    /** Ciclo del documento (ADR-0084): DRAFT = folio pendiente. */
    status: 'DRAFT' | 'POSTED' | 'CANCELLED'
    /** Eje de pago derivado del saldo (ADR-0084). */
    payment_status?: PaymentStatus
    status_display: string
    pending_amount: number
    order_delivery_status?: string
    // Purchase related fields
    purchase_order?: number | null
    purchase_order_number?: string | null
    service_obligation?: number | null
    po_receiving_status?: string | null
    serialized_payments?: Record<string, unknown>[]
    // Helper property for filtering
    is_sale_document?: boolean
    customer_name?: string
    supplier_name?: string
    corrected_invoice?: {
        id: number
        display_id: string
    } | null
    adjustments?: {
        id: number
        display_id: string
        number: string
    }[]
    lines?: {
        quantity: string | number
        product_name?: string
        description?: string
    }[]
    items?: Record<string, unknown>[]
    /** Contact of the document: sale order customer, purchase order supplier or `contact` (billing/serializers.py). */
    partner_id?: number | null
    supplier?: number
}

export interface InvoiceFilters {
    partner_name?: string
    search?: string
    status?: string
    dte_type?: string
    mode?: 'sale' | 'purchase'
    date_from?: string
    date_to?: string
    total_min?: string
    total_max?: string
    number?: string
}

export interface AnnulInvoicePayload {
    force: boolean
    reason?: string
}

export interface PaymentPayload {
    amount: number
    payment_type: 'INBOUND' | 'OUTBOUND'
    reference: string
    sale_order?: string
    invoice?: string
    payment_method: number
    transaction_number?: string
    is_pending_registration?: boolean
    treasury_account_id?: number
    dte_type?: string
    document_reference?: string
    document_date?: string
    document_attachment?: File | null
}

export * from './invoiceFromLines'
