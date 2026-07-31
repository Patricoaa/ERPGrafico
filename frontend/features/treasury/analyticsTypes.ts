// ── Analytics types for the treasury-movements panel ───────────
//
// These types model the decision-oriented dimensions of the treasury
// movements analytics view, aligned with the 4 tabs of the panel:
//   A. Flujo (flow_trend + direction_distribution)
//   B. Cuentas (account_distribution)
//   C. Métodos de pago (payment_method_distribution)
//   D. Tipos (type_distribution)
//
// All monetary values arrive as strings (Decimal) from the backend and
// are parsed client-side where needed. Counts are number of transactions.

export type MovementDirection = "IN" | "OUT" | "TRANSFER" | "ADJUSTMENT"

// ── A. Flow trend (Tab: Flujo) ─────────────────────────────────

export interface TreasuryFlowTrendRow {
    period: string
    count: number
    ingresos: string
    egresos: string
    ajustes: string
    transferencias: string
}

// ── Direction distribution (Tab: Flujo) ────────────────────────

export interface TreasuryDirectionDistributionRow {
    id: MovementDirection
    label: string
    count: number
    amount: string
}

// ── B. Accounts (Tab: Cuentas) ─────────────────────────────────

export interface TreasuryAccountDistributionRow {
    id: number | null
    account_name: string
    count: number
    in: string
    out: string
}

// ── C. Payment methods (Tab: Métodos de Pago) ─────────────────

export interface TreasuryPaymentMethodDistributionRow {
    id: string
    label: string
    count: number
    amount: string
}

// ── D. Movement types (Tab: Tipos) ─────────────────────────────

export interface TreasuryTypeDistributionRow {
    id: string
    label: string
    count: number
    amount: string
}

// ── Summary KPIs (Tab: Flujo) ──────────────────────────────────

export interface TreasuryMovementSummaryKpis {
    total_movements: number
    ingresos_count: number
    egresos_count: number
    ingresos_amount: string
    egresos_amount: string
    ajustes_amount: string
    transfer_amount: string
    net_flow: string
}

// ── Consolidated response from the analytics endpoint ──────────

export interface TreasuryMovementAnalyticsResponse {
    flow_trend: TreasuryFlowTrendRow[]
    direction_distribution: TreasuryDirectionDistributionRow[]
    account_distribution: TreasuryAccountDistributionRow[]
    payment_method_distribution: TreasuryPaymentMethodDistributionRow[]
    type_distribution: TreasuryTypeDistributionRow[]
    summary: TreasuryMovementSummaryKpis
}

export interface TreasuryMovementAnalyticsParams {
    months?: number
    granularity?: string
    treasury_account?: string | number | null
    bank?: string | number | null
    movement_type?: string | null
    payment_method?: string | null
    amount_min?: string | number | null
    amount_max?: string | number | null
    date_from?: string | null
    date_to?: string | null
}
