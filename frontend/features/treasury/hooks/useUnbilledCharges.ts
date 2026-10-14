import { useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import { staleTime } from '@/lib/query-config'

export function useUnbilledCharges(cardAccountId: number, cutOffDate?: string) {
    return useQuery({
        queryKey: ['unbilled-charges', cardAccountId, cutOffDate ?? 'all'],
        queryFn: () => treasuryApi.getUnbilledCharges(cardAccountId, cutOffDate),
        enabled: !!cardAccountId,
        staleTime: staleTime.standard,
        placeholderData: (prev) => prev,
    })
}
