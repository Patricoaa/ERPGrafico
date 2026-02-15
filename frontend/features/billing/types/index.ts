export interface Invoice {
    id: number
    number: string | null
    date: string
    dte_type: 'FACTURA' | 'BOLETA' | 'NOTA_CREDITO' | 'NOTA_DEBITO' | 'GUIA_DESPACHO'
    dte_type_display: string
    partner_name: string
    sale_order: number | null
    sale_order_number: string | null
    total: string
    status: 'DRAFT' | 'POSTED' | 'PAID' | 'CANCELLED'
    status_display: string
    pending_amount: number
    related_documents?: {
        payments?: any[]
    }
    order_delivery_status?: string
    // Helper property for filtering
    is_sale_document?: boolean
}

export interface InvoiceFilters {
    partner_name?: string
    status?: string
    dte_type?: string
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
