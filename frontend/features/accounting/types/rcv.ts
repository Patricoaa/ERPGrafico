/**
 * Tipos del Registro de Compras y Ventas (RCV) del SII.
 * Espejo del contrato REST `/api/accounting/rcv-*`. Los montos llegan como `string` (Decimal DRF).
 */

import type { FiscalMatchRef, FiscalMatchStatus } from '@/lib/fiscal-match'

export type RcvDirection = 'PURCHASES' | 'SALES'

export type RcvImportStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED'

export type RcvImportTrigger = 'SCHEDULED' | 'MANUAL'

export type RcvAttemptOutcome = 'OK' | 'QUOTA_EXHAUSTED' | 'RATE_LIMITED' | 'AUTH_KEY' | 'AUTH_SII' | 'TRANSIENT' | 'OTHER'

/** Referencia liviana a una importación ({ id, period }). */
export interface RcvImportRef {
    id: number
    /** Período del SII `YYYYMM` (p. ej. `"202610"`). */
    period: string
}

export interface RcvDocument {
    id: number
    direction: RcvDirection
    company_rut: string
    period: string
    dte_type: number
    dte_type_label: string
    folio: number
    counterparty_rut: string
    counterparty_name: string
    /** ISO date */
    issue_date: string | null
    /** ISO datetime */
    received_at: string | null
    /** ISO datetime */
    acknowledged_at: string | null
    operation_type: string
    status: string
    acknowledgement: string
    service_indicator: number | null
    exempt_amount: string
    net_amount: string
    vat_amount: string
    vat_recoverable: string
    vat_non_recoverable: string
    total_amount: string
    other_taxes_total: string
    reference_dte_type: number | null
    reference_folio: string
    is_missing: boolean
    /** Grupo de cuadre del documento; null si aún no se evalúa. */
    fiscal_match: FiscalMatchRef | null
}

export interface RcvDocumentDetail extends RcvDocument {
    raw: Record<string, unknown>
    first_import: RcvImportRef | null
    last_import: RcvImportRef | null
    missing_since_import: RcvImportRef | null
    created_at: string
    updated_at: string
}

export interface RcvImport {
    id: number
    direction: RcvDirection
    year: number
    month: number
    period: string
    trigger: RcvImportTrigger
    status: RcvImportStatus
    triggered_by: number | null
    triggered_by_name: string | null
    started_at: string | null
    finished_at: string | null
    error_code: string
    error_message: string
    warnings: string[]
    received_count: number
    created_count: number
    updated_count: number
    missing_count: number
    /** id de la API key usada */
    api_key: number | null
    masked_key: string | null
    created_at: string
}

export interface RcvImportSummary {
    id: number
    dte_type: number
    dte_type_label: string
    document_count: number
    exempt_amount: string
    net_amount: string
    vat_recoverable: string
    vat_common_use: string
    vat_non_recoverable: string
    total_amount: string
    status: string
    has_detail: boolean
    detail_count: number
    detail_total: string
}

export interface RcvImportAttempt {
    id: number
    api_key: number | null
    masked_key: string | null
    http_status: number | null
    outcome: RcvAttemptOutcome
    duration_ms: number
    error_message: string
    rate_limit_remaining: number | null
    created_at: string
}

export interface RcvImportDetail extends RcvImport {
    summaries: RcvImportSummary[]
    attempts: RcvImportAttempt[]
    raw_response: unknown
    updated_at: string
}

export interface RcvNextPeriod {
    year: number
    month: number
}

export interface RcvSettings {
    company_rut: string
    user_rut: string
    has_sii_password: boolean
    enabled: boolean
    interval_days: number
    run_hour: number
    include_purchases: boolean
    include_sales: boolean
    next_period: RcvNextPeriod
    estimated_monthly_queries: number
    total_monthly_quota: number
    /** ISO date desde la que se cuadra; null = sin cuadre de faltantes en el ERP. */
    fiscal_match_start_date: string | null
    /** Ventana del cuadre TUU, 1..240 minutos. */
    terminal_match_window_minutes: number
}

/** `sii_password` es de solo escritura: vacío o ausente la deja sin cambios. */
export interface RcvSettingsPatch {
    company_rut?: string
    user_rut?: string
    sii_password?: string
    enabled?: boolean
    interval_days?: number
    run_hour?: number
    include_purchases?: boolean
    include_sales?: boolean
    fiscal_match_start_date?: string | null
    terminal_match_window_minutes?: number
}

export interface RcvApiKey {
    id: number
    label: string
    masked_key: string
    is_active: boolean
    monthly_limit: number
    used_this_month: number
    /** ISO date */
    exhausted_until: string | null
    last_used_at: string | null
    last_error: string
}

/** `key` es obligatoria al crear y de solo escritura; en edición, vacía la deja sin cambios. */
export interface RcvApiKeyPayload {
    label?: string
    key?: string
    is_active?: boolean
    monthly_limit?: number
}

export interface RcvDocumentFilters {
    direction?: RcvDirection
    year?: number
    month?: number
    dte_type?: number
    status?: string
    acknowledgement?: string
    /** El backend solo acepta las cadenas "true" / "false". */
    missing?: 'true' | 'false'
    fiscal_match_status?: FiscalMatchStatus
    issue_date_from?: string
    issue_date_to?: string
    search?: string
    page?: number
    page_size?: number
}

export interface RcvImportFilters {
    direction?: RcvDirection
    status?: RcvImportStatus
    trigger?: RcvImportTrigger
    year?: number
    month?: number
    page?: number
    page_size?: number
}

export interface StartRcvImportPayload {
    year: number
    month: number
    directions: RcvDirection[]
}
