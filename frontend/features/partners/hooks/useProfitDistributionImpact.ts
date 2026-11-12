'use client'

import { useQuery } from '@tanstack/react-query'
import { partnersApi } from '@/features/contacts'
import { PARTNER_KEYS } from './queryKeys'

/** Proyección de impactos de ejecutar una distribución (reparto, absorción de retiros, % de participación). */
export function useProfitDistributionImpact(id: number | null) {
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: PARTNER_KEYS.distributionImpact(id ?? 0),
        queryFn: () => partnersApi.getProfitDistributionImpact(id ?? 0),
        // Depende de los destinos recién guardados: siempre se recalcula al abrir el paso.
        staleTime: 0,
        gcTime: 0,
        enabled: !!id,
    })
    return { impact: data ?? null, isLoading, isError, refetch }
}
