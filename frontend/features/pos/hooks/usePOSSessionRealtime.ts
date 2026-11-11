import type { QueryKey } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useEntitySubscription } from '@/features/realtime'
import { POS_SESSIONS_QUERY_KEY } from './usePOSSessions'

/**
 * Mantiene al día el informe X/Z de una sesión POS (ADR-0126): cualquier venta o movimiento
 * ligado a la sesión emite `treasury.possession.<id>` y se refrescan el resumen, la ficha
 * (`['pos-session', id, ...]`: detalle, overview, actividad) y el listado de sesiones.
 */
export function usePOSSessionRealtime(sessionId: number | null | undefined) {
    const queryKeys = useMemo<QueryKey[]>(
        () => (sessionId ? [['pos-session', sessionId], [...POS_SESSIONS_QUERY_KEY, 'summary', sessionId]] : []),
        [sessionId],
    )
    useEntitySubscription(sessionId ? `treasury.possession.${sessionId}` : null, queryKeys, {
        ignoreOwnActor: false,
    })
}
