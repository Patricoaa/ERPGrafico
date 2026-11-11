import { useQuery } from '@tanstack/react-query'
import { posApi } from '../api/posApi'
import type { FilterState } from '@/components/shared'
import { staleTime } from '@/lib/query-config'

export interface POSSession {
    id: number
    /** Modo de caja de este dispositivo en la sesión (SINGLE | MULTI). */
    my_mode: 'SINGLE' | 'MULTI'
    /** Id del usuario que abrió la sesión de POS. */
    user: number
    id_display: string
    user_name: string
    treasury_account: number | null
    treasury_account_name: string | null
    opened_at: string
    closed_at: string | null
    status: 'OPEN' | 'CLOSED' | 'CLOSING'
    status_display: string
    current_cash?: number
    expected_cash: number
    terminal_name?: string
    opening_balance: number
    total_cash_sales: number
    total_card_sales: number
    total_transfer_sales: number
    total_credit_sales: number
    total_check_sales: number
    total_other_cash_inflow: number
    total_other_cash_outflow: number
}

export const POS_SESSIONS_QUERY_KEY = ['posSessions']

export function usePOSSessions(filters?: FilterState) {
    const { data: sessions, isLoading, isError, refetch } = useQuery({
        queryKey: [...POS_SESSIONS_QUERY_KEY, filters],
        queryFn: async (): Promise<POSSession[]> => {
            const params: Record<string, unknown> = {}
            if (filters?.status) params.status = filters.status
            if (filters?.search) params.search = filters.search
            if (filters?.date_from) params.date_from = filters.date_from
            if (filters?.date_to) params.date_to = filters.date_to
            const data = await posApi.getSessions(params) as unknown as POSSession[]
            return data
        },
        staleTime: staleTime.volatile, // 1 min — datos operativos activos
    })

    return {
        sessions: sessions ?? [],
        isLoading,
        /** The list failed to load (the error itself is reported by the API layer). */
        isError,
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
        // ADR-0126: el X/Z se calcula fresco en el backend y se invalida por Entity Bus; al montar
        // siempre se relee para no mostrar un efectivo esperado de caché.
        staleTime: 0,
        refetchOnMount: 'always',
    })
}

/**
 * Download a POS X/Z report as PDF.
 */
export function useDownloadPOSReportPDF() {
    return {
        downloadPdf: async (sessionId: number, type: "X" | "Z") => {
            const blob = await posApi.getSessionPdf(sessionId, type)
            const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
            const link = document.createElement('a')
            link.href = url
            link.download = `informe-pos-${type}-${sessionId}.pdf`
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
        },
    }
}

/**
 * ADR-0128: motivos de diferencia disponibles y cuentas de traspaso para apertura y cierre.
 * Legible por cualquier usuario autenticado (el cajero no tiene permisos de contabilidad/tesorería).
 */
export function usePOSJustifyOptions(enabled = true) {
    return useQuery({
        queryKey: [...POS_SESSIONS_QUERY_KEY, 'justify-options'],
        queryFn: () => posApi.getJustifyOptions(),
        enabled,
        staleTime: 0,
    })
}
