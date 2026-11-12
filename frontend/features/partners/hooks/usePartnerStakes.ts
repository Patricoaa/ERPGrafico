'use client'

import { useQuery } from '@tanstack/react-query'
import { partnersApi, type PartnerEquityStake } from '@/features/contacts'
import { staleTime } from '@/lib/query-config'
import { PARTNER_KEYS } from './queryKeys'

/** Vigencias históricas del % de participación de un socio. */
export function usePartnerStakes(contactId: number | null) {
    return useQuery<PartnerEquityStake[]>({
        queryKey: PARTNER_KEYS.stakes(contactId ?? 0),
        queryFn: () => partnersApi.getEquityStakesHistory(contactId ?? 0),
        enabled: !!contactId,
        staleTime: staleTime.stable,
    })
}
