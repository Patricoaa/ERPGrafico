export interface Terminal {
    id: number
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
export type TreasuryAccountType = 'CHECKING' | 'CREDIT_CARD' | 'LOAN' | 'CASH' | 'BRIDGE' | 'CHECK_PORTFOLIO'

// Treasury Account types
export interface TreasuryAccount {
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
    current_balance?: number
    bank?: number | null
    bank_name?: string
    account_number?: string | null
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
    /** Tenders a auto-provisionar (PaymentMethod.method_type). Vacío = defaults del tipo. */
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
    /** Product used for commission purchase invoices (Stage 3). */
    commission_product: number | null
    commission_product_name?: string
    config?: Record<string, unknown>
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
}

// Terminal Batch Types
export interface TerminalBatch {
    id: number
    provider: number
    provider_name?: string
    batch_number: string
    opened_at: string
    closed_at?: string
    is_settled: boolean
    gross_amount: number
    commission_amount: number
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
    installmentNumber: number | null
    totalInstallments: number | null
    purchaseGroupDetail: CardPurchaseGroup | null
    partnerName: string | null
    chargeType: string | null
    chargeTypeDisplay: string | null
    isInstallmentInterest: boolean
    /** Referencia al PendingChargeRow original (null si es cuota) */
    originalPendingCharge: PendingChargeRow | null
    /** Referencia a la cuota original (null si es cargo) */
    originalInstallment: UpcomingInstallment | null
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
}

export interface TreasuryMovementFilters {
    treasury_account?: string | number
    movement_type?: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT'
    date?: string
    date_from?: string
    date_to?: string
    amount_min?: number | string
    amount_max?: number | string
    direction?: 'IN' | 'OUT'
    is_reconciled?: boolean
    payment_method_new?: string | number
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
    config?: Record<string, unknown>
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
    requires_reference?: boolean
    allow_for_sales?: boolean
    allow_for_purchases?: boolean
}

export type PaymentMethodUpdatePayload = Partial<PaymentMethodCreatePayload>

export interface POSSession {
    id: number
    terminal: number | null
    terminal_name?: string
    opened_at: string
    closed_at?: string
    is_active: boolean
    cash_balance: number
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

