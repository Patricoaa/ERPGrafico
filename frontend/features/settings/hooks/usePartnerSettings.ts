import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { toast } from 'sonner'
import { settingsApi } from '../api/settingsApi'
import { ACCOUNTING_SETTINGS_QUERY_KEY } from './useAccountingSettings'
import type { PartnerSettings, PartnerSettingsUpdatePayload, AccountingSettings } from '../types'
import { useRealtime } from '@/features/realtime'

interface UsePartnerSettingsReturn {
    settings: PartnerSettings
    isLoading: boolean
    saving: boolean
    updateSettings: (payload: PartnerSettingsUpdatePayload) => Promise<AccountingSettings>
    refetch: () => Promise<unknown>
}

/**
 * Custom hook for managing partner equity settings using React Query
 */
export function usePartnerSettings(): UsePartnerSettingsReturn {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: settings, isLoading, refetch } = useQuery({
        queryKey: ACCOUNTING_SETTINGS_QUERY_KEY,
        queryFn: settingsApi.getPartnerSettings,
        staleTime: 10 * 60 * 1000, // 10 min
    })

    const updateMutation = useMutation({
        mutationFn: async (payload: PartnerSettingsUpdatePayload) => {
            return settingsApi.updatePartnerSettings(payload)
        },
        onSuccess: () => {
            markLocalMutation()
            toast.success('Configuración de capital aplicada')
            invalidateCrossFeature(queryClient, [ACCOUNTING_SETTINGS_QUERY_KEY])
        },
        onError: () => {
            toast.error('Error al guardar cambios de capital')
        }
    })

    const updateSettings = updateMutation.mutateAsync

    return {
        settings: settings as PartnerSettings,
        isLoading,
        saving: updateMutation.isPending,
        updateSettings,
        refetch,
    }
}
