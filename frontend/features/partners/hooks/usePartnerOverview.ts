'use client'

import { useQuery } from '@tanstack/react-query'
import { partnersApi, type PartnerOverview } from '@/features/contacts'
import { staleTime } from '@/lib/query-config'
import { PARTNER_KEYS } from './queryKeys'

export function usePartnerOverview(contactId: number | null) {
    return useQuery<PartnerOverview>({
        queryKey: PARTNER_KEYS.overview(contactId ?? 0),
        queryFn: () => partnersApi.getOverview(contactId ?? 0),
        enabled: !!contactId,
        staleTime: staleTime.stable,
    })
}
