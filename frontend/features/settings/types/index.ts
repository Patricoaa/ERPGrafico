// Settings types for Sales, Billing, and Inventory configurations

// Sales Settings
export interface SalesSettings {
    // Revenue accounts
    default_revenue_account: string | null
    default_service_revenue_account: string | null
    default_subscription_revenue_account: string | null
    // POS accounts (Basic mapping)
    pos_default_customer: number | null
    pos_default_warehouse: number | null
    pos_default_journal: number | null
    pos_cash_account: number | null
    pos_bank_account: number | null
    pos_receivable_account: number | null
    pos_sales_account: number | null
    pos_tax_account: number | null
    pos_discount_account: number | null
    pos_rounding_account: number | null
    pos_cost_of_goods_sold_account: number | null
    pos_inventory_account: number | null
    // Terminal accounts
    terminal_commission_bridge_account: string | null
    terminal_iva_bridge_account: string | null
    // POS Configurations
    pos_default_credit_percentage: number
    pos_enable_line_discounts: boolean
    pos_enable_total_discounts: boolean
    // Permission fields for discounts
    pos_line_discount_user: number | null
    pos_line_discount_group: string
    pos_global_discount_user: number | null
    pos_global_discount_group: string
    // Credit Automation Settings
    credit_auto_block_days: number | null
    default_uncollectible_expense_account: string | null
}

export type SalesSettingsUpdatePayload = Partial<SalesSettings>

// Treasury Settings
export interface TreasurySettings {
    // Reconciliation accounts
    bank_commission_account: string | null
    interest_income_account: string | null
    exchange_difference_account: string | null
    rounding_adjustment_account: string | null
    error_adjustment_account: string | null
    miscellaneous_adjustment_account: string | null
    // POS Session Difference accounts
    pos_cash_difference_gain_account: string | null
    pos_cash_difference_loss_account: string | null
    // POS Manual Movement (adjustment) accounts
    pos_tip_account: string | null
    pos_other_inflow_account: string | null
    pos_counting_error_account: string | null
    pos_system_error_account: string | null
    pos_partner_withdrawal_account: string | null
    pos_theft_account: string | null
    pos_rounding_adjustment_account: string | null
    pos_cashback_error_account: string | null
    pos_other_outflow_account: string | null
}

export type TreasurySettingsUpdatePayload = Partial<TreasurySettings>


// Billing Settings
export interface BillingSettings {
    // Tax fields
    default_vat_rate: number
    vat_payable_account: string | number | null
    vat_carryforward_account: string | number | null
    withholding_tax_account: string | number | null
    ppm_account: string | number | null
    second_category_tax_account: string | number | null
    correction_income_account: string | number | null
    default_tax_receivable_account: string | number | null
    default_tax_payable_account: string | number | null
    // Billing fields
    default_receivable_account: string | number | null
    default_payable_account: string | number | null
    default_advance_payment_account: string | number | null
    default_prepayment_account: string | number | null
    // Additional Tax Fields
    loan_retention_account: string | number | null
    ila_tax_account: string | number | null
    vat_withholding_account: string | number | null
    // DTE Configuration
    allowed_dte_types_emit: string[]
    allowed_dte_types_receive: string[]
}

export type BillingSettingsUpdatePayload = Partial<BillingSettings>

// Inventory Settings
export interface InventorySettings {
    // Inventory accounts by type
    storable_inventory_account: string | null
    manufacturable_inventory_account: string | null
    default_consumable_account: string | null
    // Bridge accounts
    stock_input_account: string | null
    stock_output_account: string | null
    // Adjustment accounts
    adjustment_income_account: string | null
    adjustment_expense_account: string | null
    initial_inventory_account: string | null
    revaluation_account: string | null
    // COGS accounts
    merchandise_cogs_account: string | null
    manufactured_cogs_account: string | null
    // Valuation method
    inventory_valuation_method: string
}

export type InventorySettingsUpdatePayload = Partial<InventorySettings>
 
 // Partner Equity Settings
 export interface PartnerSettings {
     // Account Mappings (Equity)
     partner_capital_social_account: string | number | null
     partner_capital_social_account_name?: string
     
     partner_capital_contribution_account: string | number | null
     partner_capital_contribution_account_name?: string
     
     partner_withdrawal_account: string | number | null
     partner_withdrawal_account_name?: string
     
     partner_provisional_withdrawal_account: string | number | null
     partner_provisional_withdrawal_account_name?: string
     
     partner_retained_earnings_account: string | number | null
     partner_retained_earnings_account_name?: string
     
     partner_current_year_earnings_account: string | number | null
     partner_current_year_earnings_account_name?: string
     
     partner_dividends_payable_account: string | number | null
     partner_dividends_payable_account_name?: string
     
     partner_capital_receivable_account: string | number | null
     partner_capital_receivable_account_name?: string
 }

 
 export type PartnerSettingsUpdatePayload = Partial<PartnerSettings>
 
 // Combined settings type
 export type AccountingSettings = SalesSettings & BillingSettings & InventorySettings & TreasurySettings & PartnerSettings

// Company Settings
export interface CompanySettings {
    name: string
    trade_name: string
    tax_id: string
    address: string
    phone: string
    email: string
    website: string
    logo_url: string
    logo: string | null // This will be the URL of the uploaded file
    primary_color: string
    secondary_color: string
    business_activity: string
    contact: number | null
}

export type CompanySettingsUpdatePayload = Partial<CompanySettings> | FormData

// System Status Info
export interface SystemStatus {
    version: string
    git_hash: string
    environment: 'production' | 'development'
    database_connected: boolean
    server_time: string
}
