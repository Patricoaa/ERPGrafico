// Settings types for Sales, Billing, and Inventory configurations

// Sales Settings
export interface SalesSettings {
    // Revenue accounts
    default_revenue_account: string | null
    default_service_revenue_account: string | null
    default_subscription_revenue_account: string | null
    // POS accounts
    pos_cash_difference_gain_account: string | null
    pos_cash_difference_loss_account: string | null
    pos_tip_account: string | null
    pos_cashback_error_account: string | null
    pos_counting_error_account: string | null
    pos_system_error_account: string | null
    pos_rounding_adjustment_account: string | null
    pos_partner_withdrawal_account: string | null
    pos_theft_account: string | null
    pos_other_inflow_account: string | null
    pos_other_outflow_account: string | null
    // Terminal accounts
    terminal_commission_bridge_account: string | null
    terminal_iva_bridge_account: string | null
}

export type SalesSettingsUpdatePayload = Partial<SalesSettings>

// Billing Settings
export interface BillingSettings {
    // Tax fields
    default_vat_rate: number
    vat_payable_account: string | null
    vat_carryforward_account: string | null
    withholding_tax_account: string | null
    ppm_account: string | null
    second_category_tax_account: string | null
    correction_income_account: string | null
    default_tax_receivable_account: string | null
    default_tax_payable_account: string | null
    // Billing fields
    default_receivable_account: string | null
    default_payable_account: string | null
    default_advance_payment_account: string | null
    default_prepayment_account: string | null
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

// Combined settings type
export type AccountingSettings = SalesSettings & BillingSettings & InventorySettings
