export type TaxPeriodStatus = 'OPEN' | 'CLOSED' | 'REPORTED'

export interface TaxPeriod {
    id: number
    year: number
    month: number
    status: TaxPeriodStatus
    month_display?: string
    closed_at?: string
    closed_by_name?: string
    declaration_summary?: {
        id: number
        vat_to_pay: number
        total_paid: number
        is_fully_paid: boolean
        folio_number?: string
        payments?: TaxPayment[]
    }
}

export interface TaxDeclaration {
    id: number
    tax_period_year: number
    tax_period_month: number
    folio_number?: string
    declaration_date?: string
    vat_to_pay: number
    total_paid: number
    is_fully_paid: boolean
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

export interface TaxCalculationData {
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
