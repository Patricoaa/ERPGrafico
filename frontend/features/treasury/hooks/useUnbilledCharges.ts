import { useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'

export function useUnbilledCharges(cardAccountId: number, cutOffDate?: string) {
    return useQuery({
        queryKey: ['unbilled-charges', cardAccountId, cutOffDate ?? 'all'],
        queryFn: () => treasuryApi.getUnbilledCharges(cardAccountId, cutOffDate),
        enabled: !!cardAccountId,
        staleTime: 2 * 60 * 1000,
        placeholderData: (prev) => prev,
    })
}
