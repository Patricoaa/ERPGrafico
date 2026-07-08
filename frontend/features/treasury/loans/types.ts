export type BankLoanStatus = 'DRAFT' | 'ACTIVE' | 'PAID' | 'DEFAULTED'
export type BankLoanCurrency = 'CLP' | 'UF'
export type BankLoanAmortizationSystem = 'FRENCH' | 'LINEAR'
export type BankLoanRateBasis = 'MONTHLY' | 'ANNUAL'
export type LoanInstallmentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIAL' | 'CANCELED'

export interface LoanInstallment {
    id: number
    display_id: string
    loan: number
    loan_display_id: string
    number: number
    due_date: string
    principal_amount: string
    interest_amount: string
    insurance_amount: string
    total_amount: string
    outstanding_balance: string
    status: LoanInstallmentStatus
    status_display: string
    is_overdue: boolean
    paid_at: string | null
    payment_movement: number | null
    uf_value_used: string | null
    clp_amount_paid: string | null
    penalty_paid: string
    notes: string
}

export interface BankLoan {
    id: number
    display_id: string
    lender: number
    lender_name: string
    loan_number: string
    currency: BankLoanCurrency
    currency_display: string
    principal: string
    interest_rate: string
    rate_basis: BankLoanRateBasis
    rate_basis_display: string
    amortization_system: BankLoanAmortizationSystem
    amortization_system_display: string
    term_months: number
    start_date: string
    first_due_date: string
    insurance_monthly: string
    opening_fee: string
    stamp_tax: string
    penalty_rate: string
    disbursement_account: number
    disbursement_account_name: string
    liability_account: number
    liability_account_name: string
    status: BankLoanStatus
    status_display: string
    notes: string
    collateral_notes: string
    credit_line: number | null
    credit_line_id: number | null
    credit_line_display: string | null
    outstanding_balance: string
    total_disbursed: string
    next_due_date: string | null
    next_installment_amount: string | null
    installments_count: number
    paid_installments_count: number
    installments: LoanInstallment[]
    created_at: string
    updated_at: string
    created_by: number | null
    created_by_name: string | null
}

export interface BankLoanCreatePayload {
    lender: number
    loan_number?: string
    currency: BankLoanCurrency
    principal: string
    interest_rate: string
    rate_basis: BankLoanRateBasis
    amortization_system: BankLoanAmortizationSystem
    term_months: number
    start_date: string
    first_due_date: string
    insurance_monthly?: string
    opening_fee?: string
    stamp_tax?: string
    penalty_rate?: string
    disbursement_account: number
    liability_account: number
    credit_line?: number | null
    notes?: string
    collateral_notes?: string
}

export interface PayInstallmentPayload {
    payment_account: number
    date?: string
    principal_amount?: string
    interest_amount?: string
    insurance_amount?: string
    tax_amount?: string
    penalty_amount?: string
    interest_expense_account?: number | null
    insurance_expense_account?: number | null
}

export interface PrepayLoanPayload {
    payment_account: number
    date?: string
    insurance_amount?: string
    tax_amount?: string
    penalty_amount?: string
    interest_expense_account?: number | null
    insurance_expense_account?: number | null
}

export interface DisburseLoanPayload {
    date?: string
    opening_fee?: string
    stamp_tax?: string
    /** Override per-desembolso de la cuenta de gasto por comisión. */
    commission_expense_account?: number | null
    /** Override per-desembolso de la cuenta de gasto por ITE. */
    stamp_tax_expense_account?: number | null
}
