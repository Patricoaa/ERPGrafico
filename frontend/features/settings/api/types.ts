export interface TreasuryAccount {
    id: number
    name: string
    code: string
    identifier?: string
    account_type: string
    allows_cash: boolean
    allows_card: boolean
    allows_transfer: boolean
}

export interface PosTerminal {
    id: number
    name: string
    code: string
    location: string
    is_active: boolean
    default_treasury_account: number | null
    allowed_treasury_accounts: TreasuryAccount[]
    serial_number: string
    ip_address: string | null
}

export interface Warehouse {
    id: number
    name: string
    code?: string
}

export interface UoM {
    id: number
    name: string
    ratio: number
    category?: number
}

export interface Group {
    id: number
    name: string
    user_count?: number
}

export interface ProductMinimal {
    id: number
    name: string
    sku?: string
    cost_price?: number
    uom?: number | { id: number; name: string }
    uom_name?: string
    uom_category?: string
    qty_on_hand?: number
    has_variants?: boolean
}
