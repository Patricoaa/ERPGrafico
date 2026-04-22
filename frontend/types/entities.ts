/**
 * Centralized entity type definitions.
 * These interfaces represent the API response shapes used across selectors,
 * forms, column defs and views throughout the application.
 *
 * IMPORTANT: These are "view-layer" types — they describe the shape of data
 * as received from the Django REST API, not the database schema.
 */

// ─── Product ─────────────────────────────────────────────

export type ProductType =
    | 'STORABLE'
    | 'CONSUMABLE'
    | 'SERVICE'
    | 'MANUFACTURABLE'
    | 'SUBSCRIPTION'

export interface ProductAttributeValue {
    id: number
    attribute_name: string
    value: string
}

export interface ProductVariant {
    id: number
    name: string
    variant_display_name?: string
    current_stock?: number
    attribute_values_data?: ProductAttributeValue[]
}

export interface Product {
    id: number
    code: string
    internal_code?: string
    name: string
    product_type: ProductType
    category?: number | { id: number; name: string }
    sale_price: number | string
    sale_price_gross?: number | string
    is_dynamic_pricing?: boolean
    current_stock?: number
    qty_available?: number
    has_bom?: boolean
    manufacturable_quantity?: number
    requires_advanced_manufacturing?: boolean
    mfg_auto_finalize?: boolean
    requires_bom_validation?: boolean
    has_variants?: boolean
    variants?: ProductVariant[]
    uom?: number | { id: number; name: string; category?: number }
    sale_uom?: number | { id: number; name: string }
    purchase_uom?: number | { id: number; name: string }
    allowed_sale_uoms?: (number | { id: number; name: string })[]
    image?: string | null
    can_be_sold?: boolean
    can_be_purchased?: boolean
    track_inventory?: boolean
    receiving_warehouse?: number | { id: number; name: string }
    income_account?: number | { id: number; name: string }
    expense_account?: number | { id: number; name: string }
    preferred_supplier?: number | { id: number; name: string }

    // Manufacturing fields
    mfg_enable_prepress?: boolean
    mfg_enable_press?: boolean
    mfg_enable_postpress?: boolean
    mfg_prepress_design?: boolean
    mfg_prepress_specs?: boolean
    mfg_prepress_folio?: boolean
    mfg_press_offset?: boolean
    mfg_press_digital?: boolean
    mfg_postpress_finishing?: boolean
    mfg_postpress_binding?: boolean
    mfg_default_delivery_days?: number
    parent_template?: number | null
    attribute_values?: number[]
    attribute_values_data?: ProductAttributeValue[]
    variant_display_name?: string
    has_active_bom?: boolean

    // Subscription fields
    recurrence_period?: string
    renewal_notice_days?: number
    is_variable_amount?: boolean
    payment_day_type?: string
    payment_day?: number
    payment_interval_days?: number
    default_invoice_type?: string
    subscription_supplier?: number | { id: number; name: string }
    subscription_amount?: number
    subscription_start_date?: string
    auto_activate_subscription?: boolean
    is_indefinite?: boolean
    contract_end_date?: string

    // BOM
    boms?: ProductBOM[]
    product_custom_fields?: ProductCustomField[]
    cost_price?: number | string
    copy_bom_from?: number | string
}

export interface ProductBOMLine {
    id?: number
    component: string
    quantity: number
    uom?: string
    notes?: string
}

export interface ProductBOM {
    id?: number
    name: string
    active: boolean
    lines: ProductBOMLine[]
}

export interface ProductCustomField {
    template: number
    order: number
}

// ─── Account (Chart of Accounts) ────────────────────────

export type AccountType =
    | 'ASSET'
    | 'LIABILITY'
    | 'EQUITY'
    | 'INCOME'
    | 'EXPENSE'

export interface Account {
    id: number
    code: string
    name: string
    account_type: AccountType
    is_selectable?: boolean
    is_reconcilable?: boolean
    parent?: number | null
    balance?: number
    level?: number
}

// ─── Contact ─────────────────────────────────────────────

export type ContactType = 'PERSON' | 'COMPANY'

export interface Contact {
    id: number
    name: string
    tax_id: string | null
    email?: string
    phone?: string
    contact_type?: ContactType
    code?: string
    is_default_customer?: boolean
    is_default_vendor?: boolean
    credit_blocked?: boolean
    credit_available?: string | number
}

// ─── Treasury Account ────────────────────────────────────

export type TreasuryAccountType = 'BANK' | 'CASH' | 'CARD'

export interface TreasuryAccount {
    id: number
    name: string
    account_type: TreasuryAccountType
    current_balance?: number
    accounting_account?: number
    terminal?: number | null
    is_active?: boolean
}

// ─── Sale Order ──────────────────────────────────────────

export interface SaleOrder {
    id: number
    number: string
    customer_name: string
    created_at: string
    total: string | number
    status: string
}

// ─── Work Order ──────────────────────────────────────────

export interface WorkOrder {
    id: number
    number: string
    product_name: string
    created_at: string
    status: string
    product_description?: string
    specifications?: string
    specifications_prepress?: string
    specifications_press?: string
    specifications_postpress?: string
    prepress_archive?: string
    start_date?: string
    sale_order_delivery_date?: string
    sale_customer_name?: string
    sale_customer_rut?: string
}

// ─── UoM (Unit of Measure) ───────────────────────────────

export interface UoM {
    id: number
    name: string
    category: number
    ratio: number
    uom_type?: string
    active?: boolean
    category_name?: string
}

export interface ProductMinimal {
    id: number | string
    name: string
    code?: string
    internal_code?: string
    variant_display_name?: string
    product_type?: string
    uom?: UoM | number | string | { name: string }
    uom_name?: string
    uom_category?: number
    cost_price?: number | string
    last_purchase_price?: string | number
    purchase_uom?: number | string
    has_variants?: boolean
    track_inventory?: boolean
    requires_bom_validation?: boolean
    requires_advanced_manufacturing?: boolean
    mfg_auto_finalize?: boolean
    receiving_warehouse?: number | string | { id: number; name: string }
    preferred_supplier?: number | string | { id: number; name: string }
    preferred_supplier_name?: string
}

// ─── User ────────────────────────────────────────────────

export interface AppUser {
    id: number
    username: string
    email: string
    first_name?: string
    last_name?: string
    is_active?: boolean
    groups?: AppGroup[]
}

// ─── Group ───────────────────────────────────────────────

export interface AppGroup {
    id: number
    name: string
}

// ─── Treasury View Row Types ─────────────────────────────

export interface TreasuryAccountRow {
    id: number
    name: string
    account_type: TreasuryAccountType
    current_balance: number
    accounting_account?: { id: number; code: string; name: string } | null
    terminal?: { id: number; name: string } | null
    is_active: boolean
}

export interface TerminalBatchRow {
    id: number
    business_date: string
    terminal: { id: number; name: string }
    net_deposit: number | string
    total_commission: number | string
    status: string
    batch_count?: number
    deposit_account?: { id: number; name: string } | null
}

// ─── Workflow Types ──────────────────────────────────────

export interface WorkflowRule {
    id?: number
    task_type: string
    assigned_user?: number | null
    assigned_group?: string | null
    is_active: boolean
}

export interface NotificationRule {
    id?: number
    notification_type: string
    assigned_user?: number | null
    assigned_group?: string | null
    notify_creator?: boolean
    is_active: boolean
    send_email?: boolean
}

// ─── Pricing Rule ────────────────────────────────────────

export interface PricingRule {
    id: number
    name: string
    product?: number | null
    is_category_rule?: boolean
    start_date?: string | null
    end_date?: string | null
    min_quantity: number | string
    rule_type: string
    fixed_price?: number | string
    discount_percentage?: number | string
    active: boolean
}

// ─── Custom Field Template ────────────────────────────────

export interface CustomFieldTemplate {
    id: number
    name: string
    fields?: any[]
}

// ─── Product Category ────────────────────────────────

export interface ProductCategory {
    id: number
    name: string
    prefix?: string | null
    icon?: string
    parent?: number | null
    asset_account?: number | string | null
    income_account?: number | string | null
    expense_account?: number | string | null
}

// ─── Warehouse ──────────────────────────────────────

export interface Warehouse {
    id: number
    name: string
    code?: string
    is_active?: boolean
}
