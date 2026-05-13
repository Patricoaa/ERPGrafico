import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { treasurySchema, type TreasuryFormValues } from "@/features/settings/components/TreasurySettingsView.schema"

export const TREASURY_SETTINGS_QUERY_KEY = ['treasurySettings']

export function useTreasurySettings() {
    const { data: settings, isLoading, refetch } = useQuery({
        queryKey: TREASURY_SETTINGS_QUERY_KEY,
        queryFn: async (): Promise<TreasuryFormValues> => {
            const response = await api.get('/accounting/settings/current/')
            const data = response.data
            
            const formattedSettings: Partial<TreasuryFormValues> = {}
            const keys = Object.keys(treasurySchema.shape) as (keyof TreasuryFormValues)[]
            
            keys.forEach((key) => {
                const val = data[key]
                formattedSettings[key] = (val ? val.toString() : null) as never
            })

            return formattedSettings as TreasuryFormValues
        },
    })

    return {
        settings,
        refetch,
        isLoading,
    }
}
