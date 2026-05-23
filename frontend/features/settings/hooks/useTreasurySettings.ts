import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '../api/settingsApi'
import { treasurySchema, type TreasuryFormValues } from "@/features/settings/components/TreasurySettingsView.schema"

export const TREASURY_SETTINGS_QUERY_KEY = ['treasurySettings']

export function useTreasurySettings() {
    const { data: settings, isLoading, refetch } = useQuery({
        queryKey: TREASURY_SETTINGS_QUERY_KEY,
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
        staleTime: 10 * 60 * 1000, // 10 min
    })

    return {
        settings,
        refetch,
        isLoading,
    }
}
