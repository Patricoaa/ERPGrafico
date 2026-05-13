import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { settingsApi } from '../api/settingsApi'
import type { InventorySettings, InventorySettingsUpdatePayload } from '../types'

export const INVENTORY_SETTINGS_QUERY_KEY = ['settings-inventory']

interface UseInventorySettingsReturn {
    settings: InventorySettings
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
        queryKey: INVENTORY_SETTINGS_QUERY_KEY,
        queryFn: settingsApi.getInventorySettings,
    })

    const updateMutation = useMutation({
        mutationFn: async (payload: InventorySettingsUpdatePayload) => {
            return settingsApi.updateInventorySettings(payload)
        },
        onSuccess: () => {
            toast.success('Configuración de inventario aplicada')
            queryClient.invalidateQueries({ queryKey: INVENTORY_SETTINGS_QUERY_KEY })
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
