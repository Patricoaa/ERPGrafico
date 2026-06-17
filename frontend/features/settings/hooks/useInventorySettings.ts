import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { settingsApi } from '../api/settingsApi'
import { ACCOUNTING_SETTINGS_QUERY_KEY } from './useAccountingSettings'
import type { InventorySettings, InventorySettingsUpdatePayload } from '../types'

interface UseInventorySettingsReturn {
    settings: InventorySettings
    isLoading: boolean
    saving: boolean
    updateSettings: (payload: InventorySettingsUpdatePayload) => Promise<void>
    refetch: () => Promise<unknown>
}

/**
 * Custom hook for managing inventory settings using React Query
 */
export function useInventorySettings(): UseInventorySettingsReturn {
    const queryClient = useQueryClient()

    const { data: settings, isLoading, refetch } = useQuery({
        queryKey: ACCOUNTING_SETTINGS_QUERY_KEY,
        queryFn: settingsApi.getInventorySettings,
        staleTime: 10 * 60 * 1000, // 10 min
    })

    const updateMutation = useMutation({
        mutationFn: async (payload: InventorySettingsUpdatePayload) => {
            return settingsApi.updateInventorySettings(payload)
        },
        onSuccess: () => {
            toast.success('Configuración de inventario aplicada')
            queryClient.invalidateQueries({ queryKey: ACCOUNTING_SETTINGS_QUERY_KEY })
        },
        onError: () => {
            toast.error('Error al guardar cambios')
        }
    })

    const updateSettings = async (payload: InventorySettingsUpdatePayload) => {
        await updateMutation.mutateAsync(payload)
    }

    return {
        settings: settings as InventorySettings,
        isLoading,
        saving: updateMutation.isPending,
        updateSettings,
        refetch,
    }
}
