import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { settingsApi } from '../api/settingsApi'
import { accountingSchema, defaultsSchema, taxSchema, type AccountingFormValues, type DefaultsFormValues, type TaxFormValues } from "@/features/settings/schemas/accounting"
import { purchasingSchema, type PurchasingFormValues } from "@/features/settings/schemas/purchasing"

export const ACCOUNTING_SETTINGS_QUERY_KEY = ['accounting-settings']

export function useAccountingSettings() {
    const queryClient = useQueryClient()

    const { data: rawSettings = {} as Record<string, unknown>, isLoading, refetch } = useQuery({
        queryKey: ACCOUNTING_SETTINGS_QUERY_KEY,
        queryFn: () => settingsApi.getCurrentSettings().then(d => d as unknown as Record<string, unknown>),
        staleTime: 10 * 60 * 1000,
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

    const updateMutation = useMutation({
        mutationFn: (payload: Record<string, unknown>) => settingsApi.updateCurrentSettings(payload),
        onSuccess: () => {
            toast.success('Configuración contable aplicada')
            queryClient.invalidateQueries({ queryKey: ACCOUNTING_SETTINGS_QUERY_KEY })
        },
        onError: () => {
            toast.error('Error al guardar cambios contables')
        }
    })

    const updateSettings = async (payload: Record<string, unknown>) => {
        await updateMutation.mutateAsync(payload)
    }

    return {
        structure,
        defaults,
        tax,
        purchasing,
        refetch,
        isLoading,
        saving: updateMutation.isPending,
        updateSettings,
    }
}
