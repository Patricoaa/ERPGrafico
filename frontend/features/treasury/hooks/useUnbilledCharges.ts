import { useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import { staleTime } from '@/lib/query-config'

interface UseUnbilledChargesOptions {
    /** Tarjeta concreta. Si se omite, agrega todas (o las del `bankId`). */
    cardAccountId?: number
    /** Restringe el agregado a las tarjetas de un banco. */
    bankId?: number
    cutOffDate?: string
    /** Deshabilita la consulta (p. ej. cuando no hay tarjetas). */
    enabled?: boolean
}

export function useUnbilledCharges({
    cardAccountId,
    bankId,
    cutOffDate,
    enabled = true,
}: UseUnbilledChargesOptions = {}) {
    const scopeKey = cardAccountId ?? (bankId ? `bank-${bankId}` : 'all')
    return useQuery({
        queryKey: ['unbilled-charges', scopeKey, cutOffDate ?? 'all'],
        queryFn: () => treasuryApi.getUnbilledCharges(cardAccountId, cutOffDate, bankId),
        enabled,
        staleTime: staleTime.standard,
        placeholderData: (prev) => prev,
    })
}
