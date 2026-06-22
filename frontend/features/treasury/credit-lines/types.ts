export type CreditLineStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'SUSPENDED'
export type CreditLineRateBasis = 'MONTHLY' | 'ANNUAL'

export interface CreditLine {
    id: number
    treasury_account: number
    account_name: string
    code: string
    currency: string
    credit_limit: string
    used_amount: string
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
    created_at: string
    updated_at: string
    created_by: number | null
}

export interface CreditLineCreatePayload {
    treasury_account: number
    code?: string
    currency: string
    credit_limit: string
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
