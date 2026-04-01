// Bank Reconciliation Types

export interface BankStatement {
    id: number
    display_id: string
    treasury_account_name: string
    statement_date: string
    opening_balance: string
    closing_balance: string
    total_lines: number
    reconciled_lines: number
    reconciliation_progress: number
    state: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
    state_display: string
    imported_by_name: string
    imported_at: string
}

export interface ReconciliationRule {
    id: number
    name: string
    description: string
    treasury_account: { id: number, name: string } | null
    priority: number
    is_active: boolean
    auto_confirm: boolean
    times_applied: number
    success_rate: number
    match_config: any
}

export interface TreasuryAccount {
    id: number
    name: string
    currency?: string
    account_type?: string
}

export interface ReconciliationDashboardStats {
    total_unreconciled_lines: number
    total_unreconciled_amount: number
    oldest_unreconciled_date: string | null
    recent_activity: any[]
}
