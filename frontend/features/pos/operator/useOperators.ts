import { useMutation, useQuery } from '@tanstack/react-query'
import { posApi } from '../api/posApi'
import type { IdentifyOperatorPayload, OperatorPassResponse, PosOperator } from '../types'

export const posOperatorsQueryKey = (sessionId: number | null) => ['posOperators', sessionId] as const

/** Operadores elegibles de la sesión; solo consulta mientras el selector está abierto. */
export function useOperators(sessionId: number | null, enabled: boolean) {
    return useQuery<PosOperator[]>({
        queryKey: posOperatorsQueryKey(sessionId),
        queryFn: () => posApi.listOperators(sessionId as number),
        enabled: enabled && sessionId !== null,
        staleTime: 30_000,
    })
}

/** Identifica al operador y devuelve el pase (token en claro, una sola vez). */
export function useIdentifyOperator() {
    return useMutation<OperatorPassResponse, unknown, { sessionId: number; payload: IdentifyOperatorPayload }>({
        mutationFn: ({ sessionId, payload }) => posApi.identifyOperator(sessionId, payload),
    })
}
