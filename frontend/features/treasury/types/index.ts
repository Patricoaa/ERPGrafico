export interface Terminal {
    id: number
    /** Hay una sesión POS abierta que usa esta caja: no se puede modificar ni archivar. */
    pos_session_locked?: boolean
    name: string
    code: string
    location: string
    is_active: boolean
    allowed_payment_methods: PaymentMethod[]
    payment_terminal_device?: number
    payment_terminal_device_name?: string
    default_treasury_account_name?: string
    serial_number?: string
    ip_address?: string
}

export interface TerminalCreatePayload {
    name: string
    code: string
    location: string
    is_active: boolean
    allowed_payment_methods: number[]
    payment_terminal_device?: number | null
    default_treasury_account?: number | null
    serial_number?: string
    ip_address?: string
}

export type TerminalUpdatePayload = Partial<TerminalCreatePayload>

// Capa 1 — ubicación del dinero. F1.2 (ADR-0031): DEBIT_CARD y CHECKBOOK
// ya NO son tipos de cuenta — son formas de pago (PaymentMethod) sobre CHECKING.
// Ver `converge_treasury_accounts` y docs/50-audit/bancos/fase-1-operativo.md.
// CHECK_PORTFOLIO existe a nivel DB (cuenta puente "Cheques en Cartera" auto-gestionada).
// LOAN = cuenta-pasivo dedicada a la deuda de un crédito bancario (ADR-0041).
export type TreasuryAccountType = 'CHECKING' | 'CREDIT_CARD' | 'LOAN' | 'CASH' | 'BRIDGE' | 'CHECK_PORTFOLIO' | 'ISSUED_CHECKS'

// Treasury Account types
export interface TreasuryAccount {
    /** Campos congelados por historia contable (ADR-0091) */
    frozen_fields?: string[]
    id: number
    name: string
    code: string | null
    currency: string
    account: number | null
    account_name?: string
    account_code?: string | null
    account_type: TreasuryAccountType
    account_type_display?: string
    allows_cash: boolean
    allows_card: boolean
    allows_transfer: boolean
    allows_check: boolean
    /** true for BRIDGE — managed by provider, no manual edit/delete */
    is_system_managed: boolean
    is_active: boolean
    current_balance?: number
    available_liquidity?: number
    credit_limit?: number | null
    available_credit?: number | null
    bank?: number | null
    bank_name?: string
    account_number?: string | null
    card_number?: string | null
    identifier?: string
    /** POS terminal providers (Transbank, TUU, etc.) whose destination/bridge account is this one. */
    terminal_providers?: Array<{
        id: number
        name: string
        provider_type: PaymentTerminalProvider['provider_type']
        provider_type_display: string
        supplier?: number | null
        receivable_account?: number | null
        commission_expense_account?: number | null
        commission_iva_account?: number | null
        bank_treasury_account?: number | null
        bank_treasury_account_name?: string | null
    }>
}

export interface TreasuryAccountCreatePayload {
    name: string
    account_type: TreasuryAccountType
    currency: string
    account: number | null
    allows_cash: boolean
    allows_card: boolean
    allows_transfer: boolean
    bank?: number | null
    account_number?: string | null
    credit_limit?: number | null
    is_active?: boolean
}

export type TreasuryAccountUpdatePayload = Partial<TreasuryAccountCreatePayload>

/** Payload del asistente de alta: crea la cuenta + sus formas de pago en un paso. */
export interface TreasuryAccountProvisionPayload {
    name: string
    code?: string | null
    currency: string
    account: number | null
    account_type: TreasuryAccountType
    bank?: number | null
    account_number?: string | null
    credit_limit?: number | null
    tenders: string[]
    usage: 'sales' | 'purchases' | 'both'
}

export interface PaymentMethod {
    id: number
    name: string
    method_type: PaymentMethodType
    method_type_display: string
    treasury_account: number
    treasury_account_name: string
    settlement_account: number | null
    settlement_account_name?: string
    is_active: boolean
    allow_for_sales: boolean
    allow_for_purchases: boolean
    requires_reference?: boolean
    /** true para CARD_TERMINAL — método vinculado a dispositivo de terminal integrado */
    is_terminal_integration: boolean
    linked_terminal_device: number | null
}

// New Terminal Provider Types
export interface PaymentTerminalProvider {
    id: number
    name: string
    provider_type: 'TUU' | 'TRANSBANK' | 'MERCADOPAGO' | 'FINTOC' | 'FLOW' | 'MANUAL'
    supplier: number
    supplier_name?: string
    commission_expense_account: number
    commission_expense_account_name?: string
    commission_iva_account: number
    commission_iva_account_name?: string
    receivable_account: number
    receivable_account_name?: string
    /** TreasuryAccount (BRIDGE) where this provider settles funds. Auto-created. */
    bank_treasury_account: number | null
    bank_treasury_account_name?: string | null
    /** TreasuryAccount (CHECKING/CASH) used as default deposit destination for batches. */
    default_deposit_account: number | null
    default_deposit_account_name?: string | null
    /** Product used for commission purchase invoices (Stage 3). */
    commission_product: number | null
    commission_product_name?: string
    config?: Record<string, unknown>
    /** True when an encrypted API key is stored. The key itself is never returned. */
    has_api_key: boolean
    is_active: boolean
}

export interface PaymentTerminalDevice {
    id: number
    name: string
    provider: number
    provider_name?: string
    serial_number: string
    model?: string
    status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
    is_active: boolean
    supported_payment_methods?: number[]
    /** TC-067: stable method_type strings derived server-side from supported_payment_methods codes. */
    supported_payment_method_types?: string[]
}

// Terminal Batch Types
export interface TerminalBatch {
    id: number
    display_id?: string
    payment_method?: string
    commission_tax?: string
    notes?: string
    provider: number
    provider_name?: string
    batch_number: string
    sales_date?: string
    sales_date_end?: string
    payment_method_name?: string
    opened_at: string
    closed_at?: string
    is_settled: boolean
    status?: string
    gross_amount: number
    commission_amount: number
    commission_total?: string
    net_amount: number
    transaction_count: number
}

export interface CardPurchaseGroup {
    id: number
    uuid: string
    total_amount: string
    installments: number
    monthly_rate: string
    principal_per_installment: string
    first_installment_date: string | null
    partner_name: string | null
    partner_id: number | null
    client_reference: string
    notes: string
}

/** Cuota del cronograma de una compra en cuotas aún no facturada (ADR-0046). */
export interface UpcomingInstallment {
    id: number
    number: number
    due_date: string
    principal_amount: string
    group_id: number
    group_uuid: string
    group_display_id: string
    purchase_order_id: number | null
    purchase_order_display_id: string | null
    partner_name: string | null
    total_installments: number
}

/** Cargo pendiente de facturar (CardPendingCharge) — comisión, impuesto, etc. */
export interface PendingChargeRow {
    id: number
    amount: string
    date: string
    charge_type: string
    charge_type_display: string
    description: string
    reference: string
    source: 'pending'
}

export type UnbilledItemSource = 'pending' | 'installment'

/** Fila unificada para la tabla de cargos no facturados.
 *  Representa un CardPendingCharge (cargo pendiente) o una
 *  cuota del cronograma (CardPurchaseInstallment). */
export interface UnbilledItemRow {
    /** Clave única: "pending-{id}" | "installment-{id}" */
    id: string
    source: UnbilledItemSource
    date: string
    reference: string | null
    notes: string | null
    amount: number
    /** ISO 4217 currency code de la tarjeta; opcional, inyectado por el componente padre. */
    currency?: string
    installmentNumber: number | null
    totalInstallments: number | null
    purchaseGroupDetail: CardPurchaseGroup | null
    partnerName: string | null
    chargeType: string | null
    chargeTypeDisplay: string | null
    isInstallmentInterest: boolean
    purchaseOrderDisplayId: string | null
    /** Referencia al PendingChargeRow original (null si es cuota) */
    originalPendingCharge: PendingChargeRow | null
    /** Referencia a la cuota original (null si es cargo) */
    originalInstallment: UpcomingInstallment | null
}

export interface ByMonthItem {
    total: string
    count: number
}

export interface UnbilledForecast {
    next_statement_date: string
    days_to_next_statement: number
    next_statement_total: string
    pending_until_next_statement: string
    installments_until_next_statement: string
    by_month: Record<string, ByMonthItem>
    credit_limit: string | null
    total_used: string
    current_debt: string
    total_unbilled: string
    available_credit: string | null
}

export interface TreasuryMovement {
    id: number
    display_id: string
    movement_type: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT'
    movement_type_display: string
    payment_method: string
    payment_method_display: string
    amount: number
    created_at: string
    date: string
    created_by: number | null
    created_by_name: string
    notes: string
    pos_session: number | null
    from_account: number | null
    from_account_name: string | null
    from_account_account_id: number | null
    from_account_code: string | null
    to_account: number | null
    to_account_name: string | null
    to_account_account_id: number | null
    to_account_code: string | null
    justify_reason: string | null
    justify_reason_display: string | null
    partner_name: string | null
    partner_id: number | null
    reference: string | null
    involved_accounts?: string[]
    document_info?: {
        type: string | null
        id: number | null
        number: string | null
        label: string | null
    } | null
    card_purchase_group?: number | null
    card_purchase_group_detail?: CardPurchaseGroup | null
    installment_number?: number | null
    is_installment_interest?: boolean
    is_billed?: boolean
    billed_in_statement?: number | null
    /** Computed by serializer: POSTED | PENDING | RECONCILED */
    status?: string | null
    from_container_name?: string | null
    to_container_name?: string | null
}

export interface TreasuryMovementFilters {
    bank?: string | number
    /** Solo movimientos de cuentas bancarias (agregado de todos los bancos). */
    bank_only?: boolean
    treasury_account?: string | number
    movement_type?: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT'
    date?: string
    date_from?: string
    date_to?: string
    amount_min?: number | string
    amount_max?: number | string
    direction?: 'IN' | 'OUT'
    is_reconciled?: boolean
    payment_method?: string
    payment_method_new?: string | number
    search?: string
    display_id?: string
    partner_name?: string
    page?: number
    page_size?: number
}

export type PaymentMethodType =
    | 'CASH'
    | 'CARD'
    | 'TRANSFER'
    | 'CHECK'
    | 'CREDIT'
    | 'OTHER'
    | 'DEBIT_CARD'
    | 'CREDIT_CARD'
    | 'CARD_TERMINAL'

// Payment types
export interface PaymentCreatePayload {
    amount: number
    payment_type: 'INBOUND' | 'OUTBOUND'
    reference: string
    sale_order?: string
    invoice?: string
    payment_method: number
    transaction_number?: string
    is_pending_registration?: boolean
    treasury_account_id?: number
    dte_type?: string
    document_reference?: string
    document_date?: string
    document_attachment?: File | null
}

export interface PaymentTerminalProviderCreatePayload {
    name: string
    provider_type: PaymentTerminalProvider['provider_type']
    supplier: number
    commission_expense_account: number
    commission_iva_account: number
    receivable_account: number
    /** Product used for commission purchase invoices. */
    commission_product: number | null
    /** TreasuryAccount (CHECKING/CASH) used as default deposit destination for batches. */
    default_deposit_account?: number | null
    config?: Record<string, unknown>
    /** Write-only. Omit to keep the stored key. */
    api_key?: string
    is_active?: boolean
}

export type PaymentTerminalProviderUpdatePayload = Partial<PaymentTerminalProviderCreatePayload>

export interface PaymentTerminalDeviceCreatePayload {
    name: string
    provider: number
    serial_number: string
    model?: string
    is_active?: boolean
    supported_payment_methods?: number[]
}

export type PaymentTerminalDeviceUpdatePayload = Partial<PaymentTerminalDeviceCreatePayload>

export interface Bank {
    id: number
    name: string
    code: string | null
    swift_code?: string | null
    is_active: boolean
}

export interface BankCreatePayload {
    name: string
    code?: string | null
    swift_code?: string | null
}

export type BankUpdatePayload = Partial<BankCreatePayload>

export interface PaymentMethodCreatePayload {
    name: string
    method_type: PaymentMethodType
    treasury_account: number
    settlement_account?: number | null
    requires_reference?: boolean
    allow_for_sales?: boolean
    allow_for_purchases?: boolean
    is_active?: boolean
}

export type PaymentMethodUpdatePayload = Partial<PaymentMethodCreatePayload>

export interface POSSession {
    id: number
    terminal: number | null
    terminal_name?: string
    terminal_details?: {
        id: number
        name: string
        code: string
        location: string | null
    }
    user: number
    user_name: string
    opened_at: string
    closed_at: string | null
    closed_by_name: string | null
    status: 'OPEN' | 'CLOSED'
    status_display: string
    is_active: boolean
    cash_balance: number
    treasury_account: number | null
    treasury_account_name: string | null
    opening_balance: number
    total_cash_sales: number
    total_card_sales: number
    total_transfer_sales: number
    total_credit_sales: number
    total_check_sales: number
    total_other_cash_inflow: number
    total_other_cash_outflow: number
    expected_cash: number
    notes: string
    cash_movements: TreasuryMovement[]
    my_mode?: 'SINGLE' | 'MULTI'
}

/** Fila de la pestaña Ventas: una venta (importe +) o una devolución (importe −). */
export interface POSSessionSaleRow {
    key: string
    /** `COLLECTION`: venta de otro origen cuyo cobro se registró en la sesión (no suma a las ventas). */
    kind: 'SALE' | 'RETURN' | 'COLLECTION'
    id: number
    /** Etiqueta de entidad para abrir su ficha (`sales.saleorder` | `sales.salereturn`). */
    label: string
    display_id: string
    occurred_at: string
    customer_id: number
    customer_name: string
    /** Venta ocasional (cliente por defecto) frente a cliente identificado. */
    is_walk_in: boolean
    payment_method: string
    amount: number | string
    status: string
    status_display: string
    counts: boolean
    /** Cobrado neto de reembolsos; `null` en devoluciones. */
    collected: number | string | null
    /** Por cobrar (total − devuelto − cobrado); `null` en devoluciones y cobros de otras ventas. */
    pending: number | string | null
}

/** Cobro neto por método de pago real de la Caja POS (no por tipo fijo). */
export interface POSSessionCollection {
    key: string
    method_id: number | null
    /** Tipo del método (`CASH`, `CARD`, `TRANSFER`…). */
    method: string
    /** Nombre del método de pago tal como está configurado. */
    label: string
    /** `false`: cobró en la sesión pero hoy ya no está habilitado para la caja (o es un dato antiguo sin método). */
    enabled: boolean
    amount: number | string
    share: number | string
}

export interface POSSessionAlert {
    code: 'CASH_DIFFERENCE' | 'PAYMENT_PENDING'
    severity: 'destructive' | 'warning'
    /** Pestaña donde se investiga la alerta. */
    tab: 'sales' | 'closing'
    message: string
    amount?: number | string
    count?: number
}

export interface POSSessionClosing {
    closed_at: string
    closed_by_id: number | null
    closed_by_name: string | null
    expected_cash: number | string
    counted_cash: number | string | null
    difference: number | string | null
    /** «Coincide» compara importes; no implica que un supervisor haya revisado el cierre. */
    result: 'MATCH' | 'DIFFERENCE' | null
    notes: string
    notes_author: string | null
    notes_at: string
    /** Movimiento de ajuste que generó la diferencia, con el motivo declarado al cerrar. */
    adjustment: (POSSessionClosingMovement & { reason: string | null; reason_display: string | null }) | null
    /** Retiro de efectivo hecho al cerrar (hacia caja fuerte/banco). */
    withdrawal: POSSessionClosingMovement | null
    /** Declarado − retirado al cerrar: lo que queda en la caja. */
    left_in_box: number | string | null
}

export interface POSSessionClosingMovement {
    id: number
    display_id: string
    label: string
    amount: number | string
    destination: string | null
}

export interface POSSessionOverview {
    timezone: string
    alerts: POSSessionAlert[]
    sales: {
        gross: number | string
        returns_total: number | string
        net: number | string
        sale_count: number
        return_count: number
        includes_tax: boolean
        average_ticket: number | string
        collection_count: number
        /** Cobrado y por cobrar de las ventas de la sesión. */
        collected: number | string
        pending: number | string
        rows: POSSessionSaleRow[]
    }
    collections: POSSessionCollection[]
    closing: POSSessionClosing | null
}

export type POSSessionActivityCategory = 'caja' | 'venta' | 'acceso' | 'cierre' | 'sistema'

export interface POSSessionActivityEvent {
    key: string
    occurred_at: string
    category: POSSessionActivityCategory
    kind: string
    description: string
    actor_id: number | null
    /** `null` = origen automático del sistema. */
    actor_name: string | null
    reference: { label: string; id: number; display_id: string } | null
    /** Importe con signo del evento (ventas +, salidas −); `null` si no aplica. */
    amount: number | string | null
}

export interface TransferPayload {
    from_account_id: string
    to_account_id: string
    amount: number
    notes?: string
    date: string
}

export interface MovementCreatePayload {
    movement_type: 'INBOUND' | 'OUTBOUND' | 'TRANSFER'
    amount: number
    from_account?: number | null
    to_account?: number | null
    contact?: number | null
    notes?: string
    justify_reason?: string | null
    payment_method?: string
}

export interface TerminalBatchCreatePayload {
    provider: string
    payment_method: string
    sales_date: string | null
    sales_date_end: string | null
    gross_amount: number
    commission_base: number
    commission_tax: number
    net_amount: number
    terminal_reference?: string
    movement_ids: number[]
}

export interface MonthlyInvoicePayload {
    supplier_id: string
    month: string
    year: string
    number: string
    date: string
    document_attachment: File
}

export interface PaymentUpdatePayload {
    transaction_number?: string
    is_pending_registration?: boolean
}

export interface PartnerCapitalInfo {
    subscribed: number
    balance: number
    pending: number
}

export interface ContactBrief {
    id: number
    name: string
    partner_total_contributions?: string
    partner_balance?: string
}

// API Error types
export interface ApiErrorResponse {
    error?: string
    message?: string
    details?: Record<string, string[]>
}

export interface ApiError {
    response?: {
        data?: ApiErrorResponse
        status: number
    }
    message: string
}


/** `GET /treasury/payments/{id}/` — the payment document with its movement and accounts. */
export interface PaymentDetail {
    id: number
    display_id?: string
    status?: string
    movement_type?: string
    date?: string
    amount?: number
    reference?: string | null
    notes?: string | null
    payment_method_display?: string
    payment_method_new_name?: string | null
    treasury_account_name?: string | null
    partner_name?: string | null
    [key: string]: unknown
}

// ─── TUU terminal sales sync ─────────────────────────────────────────────────

export type TerminalSaleStatus = 'COMPLETED' | 'REVERSED' | 'OTHER'
export type TerminalSalePaymentType = 'CASH' | 'DEBIT' | 'CREDIT' | 'PREPAID' | 'UNKNOWN'
export type TerminalSaleSource = 'BRANCH' | 'GENERAL'
export type TerminalSyncTrigger = 'SCHEDULED' | 'MANUAL'
export type TerminalSyncRunStatus = 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED'

export interface TerminalSale {
    id: number
    provider: number
    provider_name: string
    device: number | null
    device_name: string | null
    serial_number: string
    sale_id: string
    sequence_number: string
    location_id: string
    /** ISO datetime */
    transaction_at: string
    status: TerminalSaleStatus
    raw_status: string
    payment_type: TerminalSalePaymentType
    document_type: number | null
    document_type_label: string
    instance: number | null
    card_brand: string
    card_issuer: string
    installment_count: number | null
    currency: string
    sale_amount: string
    tip_amount: string
    cashback_amount: string
    total_amount: string
    commission_amount: string | null
    net_amount: string | null
    /** ISO date */
    settlement_date: string | null
    settlement_id: string | null
    settlement_amount: string | null
}

export interface TerminalSaleDetail extends TerminalSale {
    natural_key: string
    card_bin: string
    card_origin: string
    installment_type: string | null
    acquirer_id: string | null
    reconciliations: Record<string, unknown>[]
    items: Record<string, unknown>[]
    raw: Record<string, unknown>
    sources: TerminalSaleSource[]
    first_seen_run: number | null
    last_seen_run: number | null
    created_at: string
    updated_at: string
}

export interface TerminalSalesSummary {
    count: number
    gross: string
    commission: string
    net: string
    by_payment_type: { payment_type: TerminalSalePaymentType; count: number; gross: string }[]
    non_completed: { count: number; total: string }
}

export interface TerminalSyncRun {
    id: number
    provider: number
    provider_name: string
    trigger: TerminalSyncTrigger
    status: TerminalSyncRunStatus
    /** ISO date */
    start_date: string
    end_date: string
    attempts: number
    /** ISO datetime */
    started_at: string
    finished_at: string | null
    error_message: string
    warnings: string[]
    fetched_count: number
    created_count: number
    updated_count: number
    triggered_by: number | null
    triggered_by_name: string | null
}

export interface TerminalSyncLastRun {
    id: number
    provider_name: string
    status: TerminalSyncRunStatus
    started_at: string
    finished_at: string | null
    error_message: string
    warnings: string[]
}

export interface TerminalSyncSettings {
    id: number
    enabled: boolean
    run_hour: number
    lookback_days: number
    /** ISO date */
    history_start_date: string | null
    max_retries: number
    retry_delay_minutes: number
    last_run: TerminalSyncLastRun | null
}

export type TerminalSyncSettingsPatch = Partial<Omit<TerminalSyncSettings, 'id' | 'last_run'>>

export interface TerminalSaleFilters {
    date_from?: string
    date_to?: string
    provider?: number
    device?: number
    document_type?: number
    payment_type?: TerminalSalePaymentType
    status?: TerminalSaleStatus
    settled?: 'true' | 'false'
    page?: number
    page_size?: number
}

/** Filters accepted by `/terminal-sales/summary/` (no pagination). */
export type TerminalSalesSummaryFilters = Omit<TerminalSaleFilters, 'page' | 'page_size'>

export interface TerminalSyncRunFilters {
    provider?: number
    status?: TerminalSyncRunStatus
    page?: number
    page_size?: number
}

/** Both dates optional (ISO); backend rejects with `{detail}` when invalid. */
export interface ManualSyncPayload {
    start_date?: string
    end_date?: string
}
