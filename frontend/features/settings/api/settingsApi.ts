import api from '@/lib/api'
import type {
    SalesSettings,
    SalesSettingsUpdatePayload,
    BillingSettings,
    BillingSettingsUpdatePayload,
    InventorySettings,
    InventorySettingsUpdatePayload,
    AccountingSettings
} from '../types'

/**
 * Centralized API service for accounting settings operations
 * Handles all HTTP requests related to sales, billing, and inventory settings
 */
export const settingsApi = {
    // ========== Current Settings (All) ==========

    /**
     * Fetch current accounting settings (all settings combined)
     */
    getCurrentSettings: async (): Promise<AccountingSettings> => {
        const { data } = await api.get<AccountingSettings>('/accounting/settings/current/')
        return data
    },

    /**
     * Update current accounting settings (partial update)
     */
    updateCurrentSettings: async (payload: Partial<AccountingSettings>): Promise<AccountingSettings> => {
        const { data } = await api.patch<AccountingSettings>('/accounting/settings/current/', payload)
        return data
    },

    // ========== Sales Settings ==========

    /**
     * Fetch sales settings
     */
    getSalesSettings: async (): Promise<Partial<SalesSettings>> => {
        const data = await settingsApi.getCurrentSettings()
        // Extract only sales-related fields
        const salesFields: (keyof SalesSettings)[] = [
            'default_revenue_account',
            'default_service_revenue_account',
            'default_subscription_revenue_account',
            'pos_cash_difference_gain_account',
            'pos_cash_difference_loss_account',
            'pos_tip_account',
            'pos_cashback_error_account',
            'pos_counting_error_account',
            'pos_system_error_account',
            'pos_rounding_adjustment_account',
            'pos_partner_withdrawal_account',
            'pos_theft_account',
            'pos_other_inflow_account',
            'pos_other_outflow_account',
            'pos_cash_difference_approval_threshold',
            'terminal_commission_bridge_account',
            'terminal_iva_bridge_account',
        ]
        const salesSettings: Partial<SalesSettings> = {}
        salesFields.forEach(field => {
            if (field in data) {
                (salesSettings as any)[field] = (data as any)[field]
            }
        })
        return salesSettings
    },

    /**
     * Update sales settings
     */
    updateSalesSettings: async (payload: SalesSettingsUpdatePayload): Promise<AccountingSettings> => {
        return settingsApi.updateCurrentSettings(payload)
    },

    // ========== Billing Settings ==========

    /**
     * Fetch billing settings
     */
    getBillingSettings: async (): Promise<Partial<BillingSettings>> => {
        const data = await settingsApi.getCurrentSettings()
        // Extract only billing-related fields
        const billingFields: (keyof BillingSettings)[] = [
            'default_vat_rate',
            'vat_payable_account',
            'vat_carryforward_account',
            'withholding_tax_account',
            'ppm_account',
            'second_category_tax_account',
            'correction_income_account',
            'default_tax_receivable_account',
            'default_tax_payable_account',
            'default_receivable_account',
            'default_payable_account',
            'default_advance_payment_account',
            'default_prepayment_account',
        ]
        const billingSettings: Partial<BillingSettings> = {}
        billingFields.forEach(field => {
            if (field in data) {
                (billingSettings as any)[field] = (data as any)[field]
            }
        })
        return billingSettings
    },

    /**
     * Update billing settings
     */
    updateBillingSettings: async (payload: BillingSettingsUpdatePayload): Promise<AccountingSettings> => {
        return settingsApi.updateCurrentSettings(payload)
    },

    // ========== Inventory Settings ==========

    /**
     * Fetch inventory settings
     */
    getInventorySettings: async (): Promise<Partial<InventorySettings>> => {
        const data = await settingsApi.getCurrentSettings()
        // Extract only inventory-related fields
        const inventoryFields: (keyof InventorySettings)[] = [
            'storable_inventory_account',
            'manufacturable_inventory_account',
            'default_consumable_account',
            'stock_input_account',
            'stock_output_account',
            'adjustment_income_account',
            'adjustment_expense_account',
            'initial_inventory_account',
            'revaluation_account',
            'merchandise_cogs_account',
            'manufactured_cogs_account',
            'inventory_valuation_method',
        ]
        const inventorySettings: Partial<InventorySettings> = {}
        inventoryFields.forEach(field => {
            if (field in data) {
                (inventorySettings as any)[field] = (data as any)[field]
            }
        })
        return inventorySettings
    },

    /**
     * Update inventory settings
     */
    updateInventorySettings: async (payload: InventorySettingsUpdatePayload): Promise<AccountingSettings> => {
        return settingsApi.updateCurrentSettings(payload)
    },
}
