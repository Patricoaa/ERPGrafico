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

// Capa 1 — ubicación del dinero. Alta nueva sólo crea CASH / CHECKING / CREDIT_CARD
// (vía TreasuryAccountWizard). DEBIT_CARD y CHECKBOOK están DEPRECADOS como tipos de
// cuenta: son formas de pago (PaymentMethod) sobre una CHECKING. Se conservan aquí
// solo para mostrar cuentas legacy aún no convergidas (ver command converge_treasury_accounts).
export type TreasuryAccountType = 'CHECKING' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CHECKBOOK' | 'CASH' | 'BRIDGE' | 'MERCHANT'

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
    /** true for BRIDGE/MERCHANT — managed by provider, no manual edit/delete */
    is_system_managed: boolean
    current_balance?: number
    bank?: number | null
    bank_name?: string
    account_number?: string | null
    identifier?: string
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

