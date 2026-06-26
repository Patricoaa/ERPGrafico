import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { settingsApi } from '../api/settingsApi'
import { useRealtime } from '@/features/realtime'
import { structureSchema, type StructureFormValues } from "@/features/settings/schemas/structure"
import { defaultsSchema, type DefaultsFormValues } from "@/features/settings/schemas/defaults"
import { taxSchema, type TaxFormValues } from "@/features/settings/schemas/tax"
import { hrSchema, type HRSettingsFormValues } from "@/features/settings/schemas/hr"
import { purchasingSchema, type PurchasingFormValues } from "@/features/settings/schemas/purchasing"

export const ACCOUNTING_SETTINGS_QUERY_KEY = ['accounting-settings']

export function useAccountingSettings() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: rawUntyped, isLoading, refetch } = useQuery({
        queryKey: ACCOUNTING_SETTINGS_QUERY_KEY,
        queryFn: () => settingsApi.getCurrentSettings().then(d => d as unknown as Record<string, unknown>),
        staleTime: 10 * 60 * 1000,
    })

    const rawSettings = rawUntyped ?? ({} as Record<string, unknown>)
    const hasData = rawUntyped !== undefined && Object.keys(rawUntyped).length > 0

    const structure = useMemo(() => {
        if (!hasData) return undefined
        const formatted = {} as StructureFormValues
        const keys = Object.keys(structureSchema.shape) as (keyof StructureFormValues)[]
        keys.forEach((key) => {
            const val = rawSettings[key]
            if (val === null || val === undefined) {
                (formatted as Record<string, unknown>)[key] = (key.includes('prefix') || key === 'code_separator' ? "" : (key === 'hierarchy_levels' ? 4 : null))
            } else {
                (formatted as Record<string, unknown>)[key] = (typeof val === 'number' ? val : val.toString())
            }
        })
        return formatted
    }, [rawSettings, hasData])

    const defaults = useMemo(() => {
        if (!hasData) return undefined
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
    }, [rawSettings, hasData])

    const tax = useMemo(() => {
        if (!hasData) return undefined
        const formatted = {} as TaxFormValues
        const keys = Object.keys(taxSchema.shape) as (keyof TaxFormValues)[]
        keys.forEach((key) => {
            const val = rawSettings[key]
            ;(formatted as Record<string, unknown>)[key] = (val ? val.toString() : null)
        })
        return formatted
    }, [rawSettings, hasData])

    const purchasing = useMemo(() => {
        if (!hasData) return undefined
        const formatted = {} as PurchasingFormValues
        const keys = Object.keys(purchasingSchema.shape) as (keyof PurchasingFormValues)[]
        keys.forEach((key) => {
            const val = rawSettings[key]
            formatted[key] = (val ? val.toString() : null) as never
        })
        return formatted
    }, [rawSettings, hasData])

    const hr = useMemo(() => {
        if (!hasData) return undefined
        const formatted = {} as HRSettingsFormValues
        const keys = Object.keys(hrSchema.shape) as (keyof HRSettingsFormValues)[]
        keys.forEach((key) => {
            const val = rawSettings[key]
            ;(formatted as Record<string, unknown>)[key] = (val ? val.toString() : null)
        })
        return formatted
    }, [rawSettings, hasData])

    const updateMutation = useMutation({
        mutationFn: (payload: Record<string, unknown>) => settingsApi.updateCurrentSettings(payload),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Configuración contable aplicada')
            queryClient.invalidateQueries({ queryKey: ACCOUNTING_SETTINGS_QUERY_KEY })
        },
        onError: () => {
            toast.error('Error al guardar cambios contables')
        }
    })

    return {
        structure,
        defaults,
        tax,
        purchasing,
        hr,
        refetch,
        isLoading,
        saving: updateMutation.isPending,
        updateSettings: updateMutation.mutateAsync,
    }
}
