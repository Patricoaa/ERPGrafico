import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { toast } from 'sonner'
import { settingsApi } from '../api/settingsApi'
import { ACCOUNTING_SETTINGS_QUERY_KEY } from './useAccountingSettings'
import { treasurySchema, type TreasuryFormValues } from "@/features/settings/schemas/treasury"
import { useRealtime } from '@/features/realtime'

export function useTreasurySettings() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: settings, isLoading, refetch } = useQuery({
        queryKey: ACCOUNTING_SETTINGS_QUERY_KEY,
        queryFn: async (): Promise<TreasuryFormValues> => {
            const data = await settingsApi.getCurrentSettings()

            const formattedSettings: Partial<TreasuryFormValues> = {}
            const keys = Object.keys(treasurySchema.shape) as (keyof TreasuryFormValues)[]

            keys.forEach((key) => {
                const val = data[key]
                formattedSettings[key] = (val ? val.toString() : null) as never
            })

            return formattedSettings as TreasuryFormValues
        },
        staleTime: 10 * 60 * 1000,
    })

    const updateMutation = useMutation({
        mutationFn: (payload: TreasuryFormValues) => settingsApi.updateCurrentSettings(payload as unknown as Record<string, unknown>),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Configuración de tesorería aplicada')
            invalidateCrossFeature(queryClient, [ACCOUNTING_SETTINGS_QUERY_KEY])
        },
        onError: () => {
            toast.error('Error al guardar cambios de tesorería')
        }
    })

    const updateSettings = updateMutation.mutateAsync

    return {
        settings,
        refetch,
        isLoading,
        saving: updateMutation.isPending,
        updateSettings,
    }
}
