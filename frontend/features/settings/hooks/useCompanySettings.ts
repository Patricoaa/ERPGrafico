import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { settingsApi } from '../api/settingsApi'
import type { CompanySettings, CompanySettingsUpdatePayload } from '../types'

export const COMPANY_SETTINGS_QUERY_KEY = ['settings-company']

interface UseCompanySettingsReturn {
    settings: CompanySettings
    saving: boolean
    updateSettings: (payload: CompanySettingsUpdatePayload) => Promise<void>
    refetch: () => Promise<any>
}

/**
 * Custom hook for managing company settings using React Query
 */
export function useCompanySettings(): UseCompanySettingsReturn {
    const queryClient = useQueryClient()

    const { data: settings, refetch } = useSuspenseQuery({
        queryKey: COMPANY_SETTINGS_QUERY_KEY,
        queryFn: settingsApi.getCompanySettings,
    })

    const updateMutation = useMutation({
        mutationFn: async (payload: CompanySettingsUpdatePayload) => {
            return settingsApi.updateCompanySettings(payload)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: COMPANY_SETTINGS_QUERY_KEY })
        },
        onError: () => {
            toast.error('Error al guardar cambios de empresa')
        }
    })

    const updateSettings = async (payload: CompanySettingsUpdatePayload) => {
        await updateMutation.mutateAsync(payload)
    }

    return {
        settings,
        saving: updateMutation.isPending,
        updateSettings,
        refetch,
    }
}
