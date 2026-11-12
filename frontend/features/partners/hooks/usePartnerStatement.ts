'use client'

import { useQuery } from '@tanstack/react-query'
import { partnersApi, type PartnerStatement } from '@/features/contacts'
import { staleTime } from '@/lib/query-config'
import { PARTNER_KEYS } from './queryKeys'

export function usePartnerStatement(contactId: number | null) {
    return useQuery<PartnerStatement>({
        queryKey: PARTNER_KEYS.statement(contactId ?? 0),
        queryFn: () => partnersApi.getStatement(contactId ?? 0),
        enabled: !!contactId,
        staleTime: staleTime.stable,
        placeholderData: (prev) => prev,
    })
}
