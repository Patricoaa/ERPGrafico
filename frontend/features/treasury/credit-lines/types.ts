export type CreditLineType = 'REVOLVING'
export type CreditLineStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'SUSPENDED'
export type CreditLineRateBasis = 'MONTHLY' | 'ANNUAL'

export interface CreditLine {
    id: number
    bank: number
    bank_name: string
    code: string
    credit_line_type: CreditLineType
    currency: string
    approved_amount: string
    drawn_amount: string
    available_amount: string
    utilization_rate: number | null
    interest_rate: string
    rate_basis: CreditLineRateBasis | null
    spread: string
    commitment_fee: string
    valid_from: string
    valid_until: string | null
    auto_renewal: boolean
    renewal_term_months: number | null
    collateral_notes: string
    notes: string
    status: CreditLineStatus
    status_display: string
    loans_count: number
    active_loans_count: number
    created_at: string
    updated_at: string
    created_by: number | null
}

export interface CreditLineCreatePayload {
    bank: number
    code?: string
    credit_line_type: CreditLineType
    currency: string
    approved_amount: string
    interest_rate?: string
    rate_basis?: CreditLineRateBasis
    spread?: string
    commitment_fee?: string
    valid_from: string
    valid_until?: string | null
    auto_renewal?: boolean
    renewal_term_months?: number | null
    collateral_notes?: string
    notes?: string
    status?: CreditLineStatus
}
