import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { settingsApi } from '../api/settingsApi'
import { ACCOUNTING_SETTINGS_QUERY_KEY } from './useAccountingSettings'
import { treasurySchema, type TreasuryFormValues } from "@/features/settings/schemas/treasury"

export function useTreasurySettings() {
    const queryClient = useQueryClient()

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
            toast.success('Configuración de tesorería aplicada')
            queryClient.invalidateQueries({ queryKey: ACCOUNTING_SETTINGS_QUERY_KEY })
        },
        onError: () => {
            toast.error('Error al guardar cambios de tesorería')
        }
    })

    const updateSettings = async (payload: TreasuryFormValues) => {
        await updateMutation.mutateAsync(payload)
    }

    return {
        settings,
        refetch,
        isLoading,
        saving: updateMutation.isPending,
        updateSettings,
    }
}
