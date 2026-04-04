export type TransactionType =
    | 'product' | 'contact' | 'sale_order' | 'purchase_order' | 'invoice' | 'payment'
    | 'sale_delivery' | 'purchase_receipt' | 'user' | 'company_settings' | 'work_order'
    | 'journal_entry' | 'stock_move' | 'cash_movement' | 'sale_return' | 'purchase_return' | 'inventory'

export interface TransactionLine {
    id?: number | string
    product_type?: string
    subtotal?: string | number
    amount?: string | number
    discount_amount?: string | number
    product_name?: string
    product_code?: string
    quantity?: number | string
    uom_name?: string
    unit_price_gross?: number
    unit_price?: number
    unit_cost?: number
    description?: string
    product?: { name?: string, sku?: string, default_code?: string }
    uom?: { name?: string }
    delivered_quantity?: number
    qty_delivered?: number
    delivery_status?: string
    sku?: string
    account_name?: string
    account_code?: string
    label?: string
    debit?: string | number
    credit?: string | number
}

export interface RelatedDocument {
    id: number | string
    display_id?: string
    number?: string | number
    type?: string
    type_display?: string
    docType?: string
    date?: string
    amount?: number | string
    method?: string
    payment_method?: string
    payment_method_display?: string
    code?: string
}

export interface TransactionData {
    id?: number | string
    display_id?: string
    number?: string | number
    reference?: string
    transaction_number?: string
    total_net?: number | string
    total_tax?: number | string
    total?: number | string
    amount?: number | string
    payment_type?: string
    movement_type?: string
    from_container_name?: string
    to_container_name?: string
    payment_method?: string
    dte_type?: string
    reference_code?: string
    code?: string
    total_discount_amount?: number | string
    total_paid?: number | string
    terminal_name?: string
    pos_session?: { id: number, terminal_name?: string }
    session?: { id: number, terminal_name?: string }
    customer?: { id?: number, name?: string, full_name?: string, tax_id?: string, email?: string, phone?: string, address?: string }
    partner?: { id?: number, name?: string, full_name?: string, tax_id?: string, email?: string, phone?: string, address?: string }
    partner_name?: string
    customer_name?: string
    notes?: string
    status?: string
    receiving_status?: string
    delivery_status?: string
    created_at?: string
    date?: string
    document_date?: string
    due_date?: string
    lines?: TransactionLine[]
    items?: TransactionLine[]
    related_docs?: RelatedDocument[]
    documents?: RelatedDocument[]
    workflow_state?: any
    [key: string]: any // Temporarily kept for backwards compatibility during migration
}
