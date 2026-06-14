// ── Analytics types for the decision-oriented TC Hub ───────────
//
// These types model the 4 decision dimensions from the hub redesign:
//   A. Payment performance (liquidity)
//   B. Financial costs
//   C. Credit utilization & risk
//   D. Purchase-group cost efficiency
//
// Each dimension aligns with a hub tab.

// ── A. Payment performance (Tab: Pagos y Flujo) ────────────────

export interface PaymentPerformanceRow {
    statement_id: number
    display_id: string
    due_date: string
    total_to_pay: string
    amount_paid: string
    outstanding: string
    paid_at: string | null
    days_late: number | null
    status: string
    punitory_interest: string
}

// ── B. Financial costs (Tab: Costos Financieros) ───────────────

export interface FinancialCostsByMonth {
    period: string
    interest: string
    fees: string
    total: string
}

// ── C. Credit utilization (Tab: Cupo y Riesgo) ─────────────────

export interface CreditUtilizationRow {
    card_account_id: number
    card_name: string
    credit_limit: string | null
    current_debt: string
    total_unbilled: string
    available_credit: string | null
    utilization_pct: number
}

// ── D. Purchase-group cost (Tab: Costos Financieros) ───────────

export interface PurchaseGroupAnalysisRow {
    group_id: number
    display_id: string
    partner_name: string | null
    total_amount: string
    installments: number
    monthly_rate: string
    total_interest: string
    total_payable: string
    effective_cost_pct: number | null
}

// ── Summary KPIs ───────────────────────────────────────────────

export interface TcSummaryKpis {
    total_debt: string
    total_unbilled: string
    open_statements: number
    overdue_statements: number
    total_past_due: string
}

// ── Consolidated response from the analytics endpoint ──────────

export interface TcHubAnalyticsResponse {
    financial_costs: FinancialCostsByMonth[]
    payment_performance: PaymentPerformanceRow[]
    credit_utilization: CreditUtilizationRow[]
    purchase_group_analysis: PurchaseGroupAnalysisRow[]
    summary: TcSummaryKpis
}
