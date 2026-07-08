import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { toast } from 'sonner'
import { settingsApi } from '../api/settingsApi'
import { ACCOUNTING_SETTINGS_QUERY_KEY } from './useAccountingSettings'
import type { BillingSettings, BillingSettingsUpdatePayload, AccountingSettings } from '../types'
import { useRealtime } from '@/features/realtime'

interface UseBillingSettingsReturn {
    settings: BillingSettings
    isLoading: boolean
    saving: boolean
    updateSettings: (payload: BillingSettingsUpdatePayload) => Promise<AccountingSettings>
    refetch: () => Promise<unknown>
}

export function useBillingSettingsQuery() {
    const { data: settings, isLoading, refetch } = useQuery({
        queryKey: ACCOUNTING_SETTINGS_QUERY_KEY,
        queryFn: settingsApi.getBillingSettings,
        staleTime: 1000 * 60 * 5,
    })

    return { settings, isLoading, refetch }
}

/**
 * Custom hook for managing billing settings using React Query
 */
export function useBillingSettings(): UseBillingSettingsReturn {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: settings, isLoading, refetch } = useQuery({
        queryKey: ACCOUNTING_SETTINGS_QUERY_KEY,
        queryFn: settingsApi.getBillingSettings,
        staleTime: 10 * 60 * 1000,
    })

    const updateMutation = useMutation({
        mutationFn: async (payload: BillingSettingsUpdatePayload) => {
            return settingsApi.updateBillingSettings(payload)
        },
        onSuccess: () => {
            markLocalMutation()
            toast.success('Configuración de facturación aplicada')
            invalidateCrossFeature(queryClient, [ACCOUNTING_SETTINGS_QUERY_KEY])
        },
        onError: () => {
            toast.error('Error al guardar cambios')
        }
    })

    const updateSettings = updateMutation.mutateAsync

    return {
        settings: settings as BillingSettings,
        isLoading,
        saving: updateMutation.isPending,
        updateSettings,
        refetch,
    }
}
