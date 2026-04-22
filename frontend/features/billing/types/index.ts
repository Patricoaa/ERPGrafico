export interface Invoice {
    id: number
    number: string | null
    date: string
    dte_type: 'FACTURA' | 'BOLETA' | 'NOTA_CREDITO' | 'NOTA_DEBITO' | 'GUIA_DESPACHO' | 'FACTURA_EXENTA' | 'BOLETA_EXENTA'
    dte_type_display: string
    partner_name: string
    sale_order: number | null
    sale_order_number: string | null
    total: string
    status: 'DRAFT' | 'POSTED' | 'PAID' | 'CANCELLED'
    status_display: string
    pending_amount: number
    related_documents?: {
        payments?: Record<string, unknown>[]
    }
    order_delivery_status?: string
    // Purchase related fields
    purchase_order?: number | null
    purchase_order_number?: string | null
    service_obligation?: number | null
    po_receiving_status?: string | null
    serialized_payments?: Record<string, unknown>[]
    related_stock_moves?: Record<string, unknown>[]
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
    items?: any[]
    partner?: number
    supplier?: number
}

export interface InvoiceFilters {
    partner_name?: string
    status?: string
    dte_type?: string
    mode?: 'sale' | 'purchase'
}

export interface AnnulInvoicePayload {
    force: boolean
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
