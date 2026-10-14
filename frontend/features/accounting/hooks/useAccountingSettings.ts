import { useQuery } from '@tanstack/react-query'
import { accountingApi } from '../api/accountingApi'
import { staleTime } from '@/lib/query-config'

export const ACCOUNTING_SETTINGS_QUERY_KEY = ['accounting', 'settings', 'current'] as const

/**
 * Settings actuales del módulo de contabilidad (cuentas por defecto, IVA, etc.).
 * Consumido por flujos transversales (checkout wizard, exports) que necesitan
 * resolver las cuentas configuradas.
 */
export function useAccountingSettings() {
    const { data: settings, isLoading, isError } = useQuery({
        queryKey: ACCOUNTING_SETTINGS_QUERY_KEY,
        queryFn: () => accountingApi.getSettings(),
        staleTime: staleTime.extended,
    })
    return { settings: settings ?? null, isLoading, isError }
}
