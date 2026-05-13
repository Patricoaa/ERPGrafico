import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { settingsApi } from '../api/settingsApi'
import type { SalesSettings, SalesSettingsUpdatePayload } from '../types'
import { useAuth } from '@/contexts/AuthContext'


export const SALES_SETTINGS_QUERY_KEY = ['settings-sales']

interface UseSalesSettingsReturn {
    settings: SalesSettings
    saving: boolean
    updateSettings: (payload: SalesSettingsUpdatePayload) => Promise<void>
    refetch: () => Promise<unknown>
    canApplyLineDiscount: boolean
    canApplyGlobalDiscount: boolean
}

/**
 * Custom hook for managing sales settings using React Query
 */
export function useSalesSettings(): UseSalesSettingsReturn {
    const queryClient = useQueryClient()

    const { data: settings, isLoading, refetch } = useQuery({
        queryKey: SALES_SETTINGS_QUERY_KEY,
        queryFn: settingsApi.getSalesSettings,
        staleTime: 10 * 60 * 1000, // 10 min
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

    const { user } = useAuth()

    // Determine line discount permissions
    let canApplyLineDiscount = settings?.pos_enable_line_discounts || false
    if (canApplyLineDiscount && user && !user.is_superuser) {
        if (settings?.pos_line_discount_user || settings?.pos_line_discount_group) {
            const matchesUser = settings.pos_line_discount_user === user.id
            const matchesGroup = settings.pos_line_discount_group && user.groups?.includes(settings.pos_line_discount_group)
            if (!matchesUser && !matchesGroup) {
                canApplyLineDiscount = false
            }
        }
    }

    // Determine global discount permissions
    let canApplyGlobalDiscount = settings?.pos_enable_total_discounts || false
    if (canApplyGlobalDiscount && user && !user.is_superuser) {
        if (settings?.pos_global_discount_user || settings?.pos_global_discount_group) {
            const matchesUser = settings.pos_global_discount_user === user.id
            const matchesGroup = settings.pos_global_discount_group && user.groups?.includes(settings.pos_global_discount_group)
            if (!matchesUser && !matchesGroup) {
                canApplyGlobalDiscount = false
            }
        }
    }

    return {
        settings: settings as SalesSettings,
        isLoading,
        saving: updateMutation.isPending,
        updateSettings,
        refetch,
        canApplyLineDiscount,
        canApplyGlobalDiscount
    }
}
