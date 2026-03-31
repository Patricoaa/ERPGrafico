import api from '@/lib/api'
import type {
    SalesSettings,
    SalesSettingsUpdatePayload,
    BillingSettings,
    BillingSettingsUpdatePayload,
    InventorySettings,
    InventorySettingsUpdatePayload,
    AccountingSettings,
    CompanySettings,
    CompanySettingsUpdatePayload,
    PartnerSettings,
    PartnerSettingsUpdatePayload
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
    getSalesSettings: async (): Promise<SalesSettings> => {
        const { data } = await api.get<SalesSettings>('/sales/settings/current/')
        // Make sure it matches our interface shape for POS fields
        return {
            ...data,
            pos_enable_line_discounts: data.pos_enable_line_discounts ?? true,
            pos_enable_total_discounts: data.pos_enable_total_discounts ?? true,
        }
    },
    /**
     * Update sales settings
     */
    updateSalesSettings: async (payload: SalesSettingsUpdatePayload): Promise<SalesSettings> => {
        const { data } = await api.patch<SalesSettings>('/sales/settings/current/', payload)
        return data
    },

    // ========== Billing Settings ==========

    /**
     * Fetch billing settings
     */
    getBillingSettings: async (): Promise<BillingSettings> => {
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
            'loan_retention_account',
            'ila_tax_account',
            'vat_withholding_account',
            'allowed_dte_types_emit',
            'allowed_dte_types_receive',
        ]
        const billingSettings: Partial<BillingSettings> = {}
        billingFields.forEach(field => {
            if (field in data) {
                (billingSettings as any)[field] = (data as any)[field]
            }
        })
        return billingSettings as BillingSettings
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
    getInventorySettings: async (): Promise<InventorySettings> => {
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
        return inventorySettings as InventorySettings
    },

    /**
     * Update inventory settings
     */
    updateInventorySettings: async (payload: InventorySettingsUpdatePayload): Promise<AccountingSettings> => {
        return settingsApi.updateCurrentSettings(payload)
    },

    // ========== Company Settings ==========

    /**
     * Fetch company settings
     */
    getCompanySettings: async (): Promise<CompanySettings> => {
        const { data } = await api.get<CompanySettings>('/core/company/current/')
        return data
    },

    /**
     * Update company settings
     */
    updateCompanySettings: async (payload: CompanySettingsUpdatePayload): Promise<CompanySettings> => {
        const config = payload instanceof FormData 
            ? { headers: { 'Content-Type': 'multipart/form-data' } }
            : undefined
        
        const { data } = await api.patch<CompanySettings>('/core/company/current/', payload, config)
        return data
    },
 
     // ========== Partner Settings ==========
 
     /**
      * Fetch partner settings
      */
     getPartnerSettings: async (): Promise<PartnerSettings> => {
         const data = await settingsApi.getCurrentSettings()
         return {
             partner_capital_social_account: data.partner_capital_social_account,
             partner_capital_social_account_name: data.partner_capital_social_account_name,
             
             partner_capital_contribution_account: data.partner_capital_contribution_account,
             partner_capital_contribution_account_name: data.partner_capital_contribution_account_name,
             
             partner_withdrawal_account: data.partner_withdrawal_account,
             partner_withdrawal_account_name: data.partner_withdrawal_account_name,
             
             partner_provisional_withdrawal_account: data.partner_provisional_withdrawal_account,
             partner_provisional_withdrawal_account_name: data.partner_provisional_withdrawal_account_name,
             
             partner_retained_earnings_account: data.partner_retained_earnings_account,
             partner_retained_earnings_account_name: data.partner_retained_earnings_account_name,
             
             partner_current_year_earnings_account: data.partner_current_year_earnings_account,
             partner_current_year_earnings_account_name: data.partner_current_year_earnings_account_name,
             
             partner_dividends_payable_account: data.partner_dividends_payable_account,
             partner_dividends_payable_account_name: data.partner_dividends_payable_account_name,
             
             partner_capital_receivable_account: data.partner_capital_receivable_account,
             partner_capital_receivable_account_name: data.partner_capital_receivable_account_name,
         }
     },

 
     /**
      * Update partner settings
      */
     updatePartnerSettings: async (payload: PartnerSettingsUpdatePayload): Promise<AccountingSettings> => {
         return settingsApi.updateCurrentSettings(payload)
     },
 }
