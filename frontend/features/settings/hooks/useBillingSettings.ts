import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { settingsApi } from '../api/settingsApi'
import type { BillingSettings, BillingSettingsUpdatePayload } from '../types'

export const BILLING_SETTINGS_QUERY_KEY = ['settings-billing']

interface UseBillingSettingsReturn {
    settings: BillingSettings
    saving: boolean
    updateSettings: (payload: BillingSettingsUpdatePayload) => Promise<void>
    refetch: () => Promise<unknown>
}

export function useBillingSettingsQuery() {
    const { data: settings, isLoading, refetch } = useQuery({
        queryKey: BILLING_SETTINGS_QUERY_KEY,
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

    const { data: settings, refetch } = useSuspenseQuery({
        queryKey: BILLING_SETTINGS_QUERY_KEY,
        queryFn: settingsApi.getBillingSettings,
    })

    const updateMutation = useMutation({
        mutationFn: async (payload: BillingSettingsUpdatePayload) => {
            return settingsApi.updateBillingSettings(payload)
        },
        onSuccess: () => {
            toast.success('Configuración de facturación aplicada')
            queryClient.invalidateQueries({ queryKey: BILLING_SETTINGS_QUERY_KEY })
        },
        onError: () => {
            toast.error('Error al guardar cambios')
        }
    })

    const updateSettings = async (payload: BillingSettingsUpdatePayload) => {
        await updateMutation.mutateAsync(payload)
    }

    return {
        settings,
        saving: updateMutation.isPending,
        updateSettings,
        refetch,
    }
}
