import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { settingsApi } from '../api/settingsApi'
import type { SalesSettings, SalesSettingsUpdatePayload } from '../types'

export const SALES_SETTINGS_QUERY_KEY = ['settings-sales']

interface UseSalesSettingsReturn {
    settings: SalesSettings
    saving: boolean
    updateSettings: (payload: SalesSettingsUpdatePayload) => Promise<void>
    refetch: () => Promise<any>
}

/**
 * Custom hook for managing sales settings using React Query
 */
export function useSalesSettings(): UseSalesSettingsReturn {
    const queryClient = useQueryClient()

    const { data: settings, refetch } = useSuspenseQuery({
        queryKey: SALES_SETTINGS_QUERY_KEY,
        queryFn: settingsApi.getSalesSettings,
    })

    const updateMutation = useMutation({
        mutationFn: async (payload: SalesSettingsUpdatePayload) => {
            return settingsApi.updateSalesSettings(payload)
        },
        onSuccess: () => {
            toast.success('Configuración de ventas aplicada')
            queryClient.invalidateQueries({ queryKey: SALES_SETTINGS_QUERY_KEY })
        },
        onError: () => {
            toast.error('Error al guardar cambios')
        }
    })

    const updateSettings = async (payload: SalesSettingsUpdatePayload) => {
        await updateMutation.mutateAsync(payload)
    }

    return {
        settings,
        saving: updateMutation.isPending,
        updateSettings,
        refetch,
    }
}
