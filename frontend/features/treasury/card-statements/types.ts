export type CreditCardStatementStatus = 'OPEN' | 'PAID' | 'OVERDUE' | 'CANCELED'

export interface CreditCardStatement {
    id: number
    display_id: string
    card_account: number
    card_account_name: string
    period_year: number
    period_month: number
    cut_off_date: string
    due_date: string
    billed_amount: string
    minimum_payment: string
    interest_charged: string
    fees_charged: string
    credit_limit: string | null
    status: CreditCardStatementStatus
    status_display: string
    is_overdue: boolean
    total_to_pay: string
    paid_at: string | null
    payment_movement: number | null
    payment_movement_id: number | null
    payment_account: number | null
    payment_account_name: string | null
    notes: string
    created_at: string
    updated_at: string
    created_by: number | null
    created_by_name: string | null
}

export interface CreditCardStatementCreatePayload {
    card_account: number
    period_year: number
    period_month: number
    cut_off_date: string
    due_date: string
    billed_amount?: string
    minimum_payment?: string
    interest_charged?: string
    fees_charged?: string
    credit_limit?: string | null
    notes?: string
}

export interface PayStatementPayload {
    payment_account: number
    date?: string
}

export interface ApplyChargesPayload {
    interest_expense_account?: number | null
    fees_expense_account?: number | null
}
