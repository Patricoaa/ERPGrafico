import { useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import { staleTime } from '@/lib/query-config'

/** Resumen, ventas, cobros netos y cierre de una sesión POS (ficha de la sesión). */
export function usePOSSessionOverview(id: number | null) {
    return useQuery({
        queryKey: ['pos-session', id, 'overview'],
        queryFn: () => treasuryApi.getPOSSessionOverview(id as number),
        staleTime: staleTime.volatile,
        enabled: !!id,
    })
}

/** Línea de tiempo de la sesión (solo lectura, más reciente primero). */
export function usePOSSessionActivity(id: number | null, enabled = true) {
    return useQuery({
        queryKey: ['pos-session', id, 'activity'],
        queryFn: () => treasuryApi.getPOSSessionActivity(id as number),
        staleTime: staleTime.volatile,
        enabled: !!id && enabled,
    })
}
