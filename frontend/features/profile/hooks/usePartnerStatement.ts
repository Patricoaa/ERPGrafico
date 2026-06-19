'use client'

import { useQuery } from '@tanstack/react-query'
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { PROFILE_KEYS } from './queryKeys'
import type { PartnerStatement } from "@/features/contacts/types/partner"

export function usePartnerStatement(contactId: number | null) {
    return useQuery<PartnerStatement>({
        queryKey: PROFILE_KEYS.partnerStatement(contactId ?? 0),
        queryFn: () => partnersApi.getStatement(contactId ?? 0),
        enabled: !!contactId,
        staleTime: 5 * 60 * 1000,
    })
}
