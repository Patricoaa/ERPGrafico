export type CheckStatus = 'IN_PORTFOLIO' | 'DEPOSITED' | 'CLEARED' | 'BOUNCED' | 'VOIDED' | 'ISSUED'
export type CheckDirection = 'RECEIVED' | 'ISSUED'

export interface Check {
    id: number
    display_id: string
    direction: CheckDirection
    direction_display: string
    status: CheckStatus
    status_display: string
    is_overdue: boolean
    bank: number
    bank_name: string
    check_number: string
    amount: string
    issue_date: string
    due_date: string
    counterparty: number | null
    counterparty_name: string | null
    drawer_name: string
    portfolio_account: number
    deposit_account: number | null
    receipt_movement: number | null
    settlement_movement: number | null
    invoice: number | null
    sale_order: number | null
    notes: string
    deposited_at: string | null
    cleared_at: string | null
    bounced_at: string | null
    created_at: string
    created_by: number | null
}

export interface CheckCreatePayload {
    bank: number
    check_number: string
    amount: string
    issue_date: string
    due_date: string
    counterparty?: number | null
    drawer_name?: string
    notes?: string
    invoice?: number | null
    sale_order?: number | null
}

export interface CheckDepositPayload {
    deposit_account: number
}

export interface CheckPortfolioSummary {
    checks: Check[]
    total: string
}

export interface CheckInTransitSummary {
    checks: Check[]
    total: string
}
