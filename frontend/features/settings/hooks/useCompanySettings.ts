import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { toast } from 'sonner'
import { settingsApi } from '../api/settingsApi'
import type { CompanySettings, CompanySettingsUpdatePayload } from '../types'
import { useRealtime } from '@/features/realtime'

export const COMPANY_SETTINGS_QUERY_KEY = ['settings-company']

interface UseCompanySettingsReturn {
    settings: CompanySettings | undefined
    isLoading: boolean
    saving: boolean
    updateSettings: (payload: CompanySettingsUpdatePayload) => Promise<CompanySettings>
    refetch: () => Promise<unknown>
}

/**
 * Custom hook for managing company settings using React Query
 */
export function useCompanySettings(): UseCompanySettingsReturn {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: settings, refetch, isLoading } = useQuery({
        queryKey: COMPANY_SETTINGS_QUERY_KEY,
        queryFn: settingsApi.getCompanySettings,
        staleTime: 10 * 60 * 1000, // 10 min
    })

    const updateMutation = useMutation({
        mutationFn: async (payload: CompanySettingsUpdatePayload) => {
            return settingsApi.updateCompanySettings(payload)
        },
        onSuccess: () => {
            markLocalMutation()
            toast.success('Configuración de empresa aplicada')
            invalidateCrossFeature(queryClient, [COMPANY_SETTINGS_QUERY_KEY])
        },
        onError: () => {
            toast.error('Error al guardar cambios de empresa')
        }
    })

    const updateSettings = updateMutation.mutateAsync

    return {
        settings,
        isLoading,
        saving: updateMutation.isPending,
        updateSettings,
        refetch,
    }
}
