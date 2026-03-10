// Terminal types
export interface Terminal {
    id: number
    name: string
    code: string
    location: string
    is_active: boolean
    allowed_payment_methods: PaymentMethod[]
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
    default_treasury_account?: number | null
    serial_number?: string
    ip_address?: string
}

export interface TerminalUpdatePayload extends Partial<TerminalCreatePayload> { }

// Treasury Account types
export interface TreasuryAccount {
    id: number
    name: string
    code: string | null
    currency: string
    account: number | null
    account_name?: string
    account_code?: string | null
    account_type: 'CHECKING' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CHECKBOOK' | 'CASH'
    allows_cash: boolean
    allows_card: boolean
    allows_transfer: boolean
    location: string
    custodian: number | null
    custodian_name?: string
    is_physical: boolean
    current_balance?: number
    bank?: number | null
    bank_name?: string
    account_number?: string | null
}

export interface TreasuryAccountCreatePayload {
    name: string
    account_type: TreasuryAccount['account_type']
    currency: string
    account: number | null
    allows_cash: boolean
    allows_card: boolean
    allows_transfer: boolean
    location: string
    custodian: number | null
    is_physical: boolean
    bank?: number | null
    account_number?: string | null
}

export interface TreasuryAccountUpdatePayload extends Partial<TreasuryAccountCreatePayload> { }

// Payment Method types
export interface PaymentMethod {
    id: number
    name: string
    method_type: PaymentMethodType
    method_type_display: string
    treasury_account: number
    treasury_account_name: string
    is_active: boolean
    is_terminal: boolean
    allow_for_sales: boolean
}

export type PaymentMethodType =
    | 'CASH'
    | 'CARD'
    | 'TRANSFER'
    | 'CHECK'
    | 'CREDIT'
    | 'OTHER'
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
