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

export interface BankStatementLine {
    id: number
    line_number: number
    transaction_date: string
    description: string
    reference: string
    debit: string
    credit: string
    balance: string
    reconciliation_state: string
    reconciliation_state_display: string
}

export interface ReconciliationSystemItem {
    id: number
    amount: string
    date: string
    contact_name: string
    display_id?: string
    code?: string
    is_batch?: boolean
    identifier?: string
    name?: string
}

export interface MatchConfig {
    criteria?: string[]
    min_score?: number
    lookback_days?: number
    amount_tolerance?: number
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
    match_config: MatchConfig
}

export interface TreasuryAccount {
    id: number
    name: string
    currency?: string
    account_type?: string
}

export interface DashboardPendingItem {
    id: number
    date: string
    account: string
    description: string
    amount: number
    is_credit: boolean
    days_pending: number
    is_overdue: boolean
    statement_id: number
}

export interface DashboardKPIData {
    lines: {
        total: number
        reconciled: number
        pending: number
    }
    reconciliation_rate: number
    differences: {
        count: number
        total_amount: number
        by_type: Record<string, { label: string; count: number }>
    }
    statements: {
        total: number
        confirmed: number
        draft: number
    }
}

export interface TrendItem {
    month: string
    total_lines: number
    reconciled_lines: number
}

export interface RecentActivity {
    id: number
    type: 'MATCH' | 'IMPORT' | 'CONFIRM' | 'EXCLUDE'
    description: string
    timestamp: string
    user_name: string
}

export interface ReconciliationDashboardStats {
    total_unreconciled_lines: number
    total_unreconciled_amount: number
    oldest_unreconciled_date: string | null
    recent_activity: RecentActivity[]
}
