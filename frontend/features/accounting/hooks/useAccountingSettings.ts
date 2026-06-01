import { useQuery } from '@tanstack/react-query'
import { accountingApi } from '../api/accountingApi'

export const ACCOUNTING_SETTINGS_QUERY_KEY = ['accounting', 'settings', 'current'] as const

/**
 * Settings actuales del módulo de contabilidad (cuentas por defecto, IVA, etc.).
 * Consumido por flujos transversales (checkout wizard, exports) que necesitan
 * resolver las cuentas configuradas.
 */
export function useAccountingSettings() {
    return useQuery({
        queryKey: ACCOUNTING_SETTINGS_QUERY_KEY,
        queryFn: () => accountingApi.getSettings(),
        staleTime: 30 * 60 * 1000, // 30 min — configuración cambia raramente
    })
}
