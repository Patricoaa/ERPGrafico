import { useQuery } from "@tanstack/react-query"
import { partnersApi } from "@/features/contacts"
import type { PartnerEvolutionPeriod } from "@/features/contacts"
import type { Granularity } from "@/lib/analytics-helpers"

export interface PartnerEvolutionData {
    periods: PartnerEvolutionPeriod[]
    isLoading: boolean
    isError: boolean
    error: Error | null
}

export function usePartnerEvolutionData(
    months = 24,
    granularity: Granularity = "month",
): PartnerEvolutionData {
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["partner-evolution", months, granularity],
        queryFn: () => partnersApi.getPartnerEvolution(months, granularity),
    })

    return {
        periods: data?.periods ?? [],
        isLoading,
        isError,
        error,
    }
}
