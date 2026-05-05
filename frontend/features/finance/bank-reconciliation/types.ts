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
    /** @deprecated Used only for legacy batch suggestions from matching service */
    is_batch?: boolean
    identifier?: string
    name?: string
    movement_type?: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT'
    from_account?: number
    to_account?: number
    is_pending_registration?: boolean
    terminal_batch_id?: number | null
    terminal_batch_display?: string | null
}

export interface MatchConfig {
    criteria?: string[]
    min_score?: number
    lookback_days?: number
    amount_tolerance?: number
}

export interface ReconciliationSettings {
    id: number
    amount_weight: number
    date_weight: number
    reference_weight: number
    contact_weight: number
    confidence_threshold: number
    date_range_days: number
    auto_confirm: boolean
}

export interface TreasuryAccount {
    id: number
    name: string
    currency?: string
    account_type?: string
    reconciliation_settings?: ReconciliationSettings
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

export interface PaginatedResponse<T> {
    results: T[]
    count: number
    next: string | null
    previous: string | null
}

export interface QueryPaginationParams {
    page?: number
    pageSize?: number
    search?: string
    date_from?: string
    date_to?: string
    amount_min?: number
    amount_max?: number
}

// S5.1: Payment Allocation
export interface PaymentAllocation {
    id: number
    treasury_movement: number
    amount: string
    notes?: string
    invoice?: number
    invoice_display_id?: string
    sale_order?: number
    sale_order_display_id?: string
    purchase_order?: number
    purchase_order_display_id?: string
    bank_statement_line?: number
    bank_statement_line_display?: string
    created_at: string
    created_by_name?: string
}

export interface PaymentAllocationPayload {
    amount: number | string
    notes?: string
    invoice?: number
    sale_order?: number
    purchase_order?: number
    bank_statement_line?: number
}
