import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { accountingSchema, defaultsSchema, taxSchema, type AccountingFormValues, type DefaultsFormValues, type TaxFormValues } from "@/features/settings/components/AccountingSettingsView.schema"
import { purchasingSchema, type PurchasingFormValues } from "@/features/settings/components/PurchasingSettingsView.schema"

export const ACCOUNTING_SETTINGS_QUERY_KEY = ['accountingSettings']

export function useAccountingSettings() {
    const { data: rawSettings = {}, isLoading, refetch } = useQuery({
        queryKey: ACCOUNTING_SETTINGS_QUERY_KEY,
        queryFn: async () => {
            const response = await api.get('/accounting/settings/current/')
            return response.data
        },
        staleTime: 10 * 60 * 1000, // 10 min — settings cambian raramente
    })

    const structure = (() => {
        const formatted = {} as AccountingFormValues
        const keys = Object.keys(accountingSchema.shape) as (keyof AccountingFormValues)[]
        keys.forEach((key) => {
            const val = rawSettings[key]
            if (val === null || val === undefined) {
                (formatted as Record<string, unknown>)[key] = (key.includes('prefix') || key === 'code_separator' ? "" : (key === 'hierarchy_levels' ? 4 : null))
            } else {
                (formatted as Record<string, unknown>)[key] = (typeof val === 'number' ? val : val.toString())
            }
        })
        return formatted
    })()

    const defaults = (() => {
        const formatted = {} as DefaultsFormValues
        const keys = Object.keys(defaultsSchema.shape) as (keyof DefaultsFormValues)[]
        keys.forEach((key) => {
            const val = rawSettings[key]
            if (val === null || val === undefined) {
                (formatted as Record<string, unknown>)[key] = null
            } else {
                (formatted as Record<string, unknown>)[key] = val.toString()
            }
        })
        return formatted
    })()

    const tax = (() => {
        const formatted = {} as TaxFormValues
        const keys = Object.keys(taxSchema.shape) as (keyof TaxFormValues)[]
        keys.forEach((key) => {
            const val = rawSettings[key]
            if (val === null || val === undefined) {
                (formatted as Record<string, unknown>)[key] = (key === 'default_vat_rate' ? 19.00 : null)
            } else if (key === 'default_vat_rate') {
                (formatted as Record<string, unknown>)[key] = parseFloat(val.toString())
            } else {
                (formatted as Record<string, unknown>)[key] = val.toString()
            }
        })
        return formatted
    })()

    const purchasing = (() => {
        const formatted = {} as PurchasingFormValues
        const keys = Object.keys(purchasingSchema.shape) as (keyof PurchasingFormValues)[]
        keys.forEach((key) => {
            const val = rawSettings[key]
            formatted[key] = (val ? val.toString() : null) as never
        })
        return formatted
    })()

    return {
        structure,
        defaults,
        tax,
        purchasing,
        refetch,
        isLoading,
    }
}
