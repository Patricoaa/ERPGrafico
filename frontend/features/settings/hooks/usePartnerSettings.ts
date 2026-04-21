import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { settingsApi } from '../api/settingsApi'
import type { PartnerSettings, PartnerSettingsUpdatePayload } from '../types'

export const PARTNER_SETTINGS_QUERY_KEY = ['settings-partner']

interface UsePartnerSettingsReturn {
    settings: PartnerSettings
    saving: boolean
    updateSettings: (payload: PartnerSettingsUpdatePayload) => Promise<void>
    refetch: () => Promise<unknown>
}

/**
 * Custom hook for managing partner equity settings using React Query
 */
export function usePartnerSettings(): UsePartnerSettingsReturn {
    const queryClient = useQueryClient()

    const { data: settings, refetch } = useSuspenseQuery({
        queryKey: PARTNER_SETTINGS_QUERY_KEY,
        queryFn: settingsApi.getPartnerSettings,
    })

    const updateMutation = useMutation({
        mutationFn: async (payload: PartnerSettingsUpdatePayload) => {
            return settingsApi.updatePartnerSettings(payload)
        },
        onSuccess: () => {
            // No toast here to keep it subtle as it auto-saves
            queryClient.invalidateQueries({ queryKey: PARTNER_SETTINGS_QUERY_KEY })
        },
        onError: () => {
            toast.error('Error al guardar cambios de capital')
        }
    })

    const updateSettings = async (payload: PartnerSettingsUpdatePayload) => {
        await updateMutation.mutateAsync(payload)
    }

    return {
        settings,
        saving: updateMutation.isPending,
        updateSettings,
        refetch,
    }
}
