import { useQuery } from '@tanstack/react-query'
import { posApi } from '../api/posApi'
import type { FilterState } from '@/components/shared'

export interface POSSession {
    id: number
    id_display: string
    user_name: string
    treasury_account: number
    treasury_account_name: string
    opened_at: string
    closed_at: string | null
    status: 'OPEN' | 'CLOSED' | 'CLOSING'
    status_display: string
    start_amount: number
    current_cash?: number
    expected_cash: number
    terminal_name?: string
    opening_balance: number
    total_cash_sales: number
    total_card_sales: number
    total_transfer_sales: number
    total_credit_sales: number
    total_other_cash_inflow: number
    total_other_cash_outflow: number
}

export const POS_SESSIONS_QUERY_KEY = ['posSessions']

export function usePOSSessions(filters?: FilterState) {
    const { data: sessions, isLoading, refetch } = useQuery({
        queryKey: [...POS_SESSIONS_QUERY_KEY, filters],
        queryFn: async (): Promise<POSSession[]> => {
            const params: Record<string, unknown> = {}
            if (filters?.status) params.status = filters.status
            if (filters?.search) params.search = filters.search
            const data = await posApi.getSessions(params) as unknown as POSSession[]
            return data
        },
        staleTime: 60 * 1000, // 1 min — datos operativos activos
    })

    return {
        sessions: sessions ?? [],
        isLoading,
        refetch,
    }
}

/**
 * Imperative one-shot fetch del summary de una sesión POS.
 * Útil cuando el caller necesita el dato antes de abrir un modal y no
 * quiere reestructurar el flujo en un hook reactivo. Mantiene la llamada
 * a `api` dentro de la capa de hooks (cumple invariante #5).
 */
export async function fetchPOSSessionSummary<T = Record<string, unknown>>(sessionId: number): Promise<T> {
    return posApi.getSessionSummary(sessionId) as Promise<T>
}

/**
 * Resumen agregado de una sesión POS (totales por método de pago, cash diff,
 * documentos asociados). Usado para generar reportes X (sesión abierta) y
 * Z (sesión cerrada).
 *
 * Forma exacta del response es consumida localmente por POSReport;
 * tipo genérico para no acoplar.
 */
export function usePOSSessionSummary<T = Record<string, unknown>>(sessionId: number | null | undefined) {
    return useQuery<T | null>({
        queryKey: sessionId ? [...POS_SESSIONS_QUERY_KEY, 'summary', sessionId] : [...POS_SESSIONS_QUERY_KEY, 'summary', 'noop'],
        queryFn: async () => {
            if (!sessionId) return null
            return posApi.getSessionSummary(sessionId) as Promise<T>
        },
        enabled: !!sessionId,
        // Summary se computa server-side y es relativamente costoso; sin staleTime
        // explícito → vuelve a fetchear según el global staleTime (5min).
    })
}
