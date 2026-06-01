import { useQuery } from '@tanstack/react-query'
import { partnersApi } from '../api/partnersApi'
import type { Partner } from '../types/partner'

export const PARTNERS_KEYS = {
    all: ['partners'] as const,
    list: () => [...PARTNERS_KEYS.all, 'list'] as const,
}

/**
 * Lista de contactos marcados como socios (`is_partner = true`).
 * Read-only — las mutaciones de partners (setup, transactions, distributions,
 * etc.) se exponen vía partnersApi y deberían tener sus propios hooks
 * dedicados cuando se necesiten (no se incluyen aquí para evitar scope creep).
 */
export function usePartners() {
    return useQuery<Partner[]>({
        queryKey: PARTNERS_KEYS.list(),
        queryFn: () => partnersApi.getPartners(),
        staleTime: 5 * 60 * 1000,
    })
}
