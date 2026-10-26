export type TaxPeriodStatus = 'OPEN' | 'CLOSED' | 'REPORTED'

export interface TaxPeriod {
    id: number
    year: number
    month: number
    status: TaxPeriodStatus
    status_display?: string
    month_display?: string
    closed_at?: string
    closed_by_name?: string
    declaration_summary?: {
        id: number
        vat_to_pay: number
        total_paid: number
        is_fully_paid: boolean
        folio_number?: string
        document?: string | null
        payments?: TaxPayment[]
    }
}

export interface TaxDeclaration {
    id: number
    tax_period_year: number
    tax_period_month: number
    folio_number?: string
    document?: string | null
    declaration_date?: string
    vat_to_pay: number
    total_paid: number
    is_fully_paid: boolean
    tax_period?: number
    tax_period_display: string
    ppm_amount: number
    withholding_tax: number
    vat_credit_carryforward: number
    vat_correction_amount: number
    second_category_tax: number
    loan_retention: number
    ila_tax: number
    vat_withholding: number
    tax_rate: number
    notes?: string
    payments: TaxPayment[]
}

export interface TaxPayment {
    id: number
    payment_date: string
    amount: number
    payment_method_display: string
}

export interface DteBreakdownItem {
    dte_type: string
    dte_type_display: string
    total: number
    count: number
}

export interface TaxCalculationData {
    tax_period_id?: number
    year: number
    month: number
    sales_taxed: number
    sales_exempt: number
    net_taxed_sales: number
    vat_debit: number
    purchases_taxed: number
    purchases_exempt: number
    net_taxed_purchases: number
    vat_credit: number
    vat_credit_carryforward: number
    tax_rate: number
    credit_notes_taxed?: number
    purchase_credit_notes?: number
    sales_taxed_by_dte?: DteBreakdownItem[]
    sales_exempt_by_dte?: DteBreakdownItem[]
    purchases_taxed_by_dte?: DteBreakdownItem[]
    purchases_exempt_by_dte?: DteBreakdownItem[]
    drafts_summary?: {
        invoices: {
            id: number
            display_id: string
            total: number
            date: string
            type: 'sale' | 'purchase'
        }[]
        entries: {
            id: number
            display_id: string
            description: string
            date: string
        }[]
    }
}

/**
 * Data payload emitted by PaymentDialog.onConfirm when registering a tax payment.
 * Mirrors the PaymentDialog onConfirm callback shape (subset used for F29 flows).
 */
export interface TaxPaymentData {
    paymentMethod: string
    amount: number
    dteType?: string
    reference?: string
    transaction_number?: string
    is_pending_registration?: boolean
    treasury_account_id?: string | null
    payment_method_new?: string | null
    documentReference?: string
    documentDate?: string
    documentAttachment?: File | null
}

/** `GET /tax/periods/{id}/` — the list item plus the date range of the period. */
export interface TaxPeriodDetail extends TaxPeriod {
    start_date?: string
    end_date?: string
    tax_period_display?: string
}

/** `GET /tax/f29/{id}/` — a registered F29 declaration with its accounting entry. */
export interface F29Detail extends TaxDeclaration {
    period_display?: string
    declared_by?: string | null
    is_registered?: boolean
    journal_entry?: number | null
    journal_entry_display?: string | null
}

export interface TaxPeriodCheck {
    is_closed: boolean
    date: string
}
