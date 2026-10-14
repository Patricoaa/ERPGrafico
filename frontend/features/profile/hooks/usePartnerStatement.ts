'use client'

import { useQuery } from '@tanstack/react-query'
import { partnersApi, type PartnerStatement } from "@/features/contacts"
import { PROFILE_KEYS } from './queryKeys'
import { staleTime } from '@/lib/query-config'

export function usePartnerStatement(contactId: number | null) {
    return useQuery<PartnerStatement>({
        queryKey: PROFILE_KEYS.partnerStatement(contactId ?? 0),
        queryFn: () => partnersApi.getStatement(contactId ?? 0),
        enabled: !!contactId,
        staleTime: staleTime.stable,
        placeholderData: (prev) => prev,
    })
}
