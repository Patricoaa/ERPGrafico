'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useRealtime } from '@/features/realtime'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { showApiError } from '@/lib/errors'
import { staleTime } from '@/lib/query-config'
import { fiscalMatchApi } from '../api/fiscalMatchApi'
import type { FiscalMatchFilters, FiscalMatchLinkBody, FiscalMatchPart, FiscalMatchUnlinkBody } from '../types/fiscalMatch'
import { FISCAL_MATCH_KEYS, FISCAL_MATCH_KEY } from './fiscalMatchKeys'
import { RCV_DOCUMENTS_KEY, TERMINAL_SALES_KEY } from './reconciliationKeys'

/** Página de grupos de cuadre; conserva la anterior mientras carga la siguiente. */
export function useFiscalMatches(filters: FiscalMatchFilters, page = 1) {
    const { data, isLoading, isError, isRefetching, refetch } = useQuery({
        queryKey: FISCAL_MATCH_KEYS.list(filters, page),
        queryFn: ({ signal }) => fiscalMatchApi.list(filters, page, signal),
        placeholderData: keepPreviousData,
        staleTime: staleTime.standard,
    })
    return { page: data, groups: data?.results ?? [], totalCount: data?.count ?? 0, isLoading, isError, isRefetching, refetch }
}

/** Conteos por estado y última corrida del motor; se refresca cada minuto. */
export function useFiscalMatchCounts(filters: FiscalMatchFilters) {
    const { data, isLoading, isError, isRefetching, refetch } = useQuery({
        queryKey: FISCAL_MATCH_KEYS.counts(filters),
        queryFn: () => fiscalMatchApi.counts(filters),
        refetchInterval: 60_000,
        staleTime: staleTime.standard,
    })
    return { counts: data, isLoading, isError, isRefetching, refetch }
}

export function useFiscalMatch(id: number | null | undefined) {
    const { data, isLoading, isError, isRefetching, refetch } = useQuery({
        queryKey: FISCAL_MATCH_KEYS.detail(id ?? 0),
        queryFn: () => fiscalMatchApi.get(id as number),
        enabled: typeof id === 'number' && id > 0,
        staleTime: staleTime.standard,
    })
    return { group: data, isLoading, isError, isRefetching, refetch }
}

export function useFiscalMatchCandidates<P extends FiscalMatchPart>(id: number, part: P, enabled = true) {
    const { data, isLoading, isError, isRefetching, refetch } = useQuery({
        queryKey: FISCAL_MATCH_KEYS.candidates(id, part),
        queryFn: () => fiscalMatchApi.candidates(id, part),
        enabled: enabled && id > 0,
        staleTime: staleTime.standard,
    })
    return { candidates: data ?? [], isLoading, isError, isRefetching, refetch }
}

export function useFiscalMatchSummary(year: number, month: number) {
    const { data, isLoading, isError, isRefetching, refetch } = useQuery({
        queryKey: FISCAL_MATCH_KEYS.summary(year, month),
        queryFn: () => fiscalMatchApi.summary(year, month),
        staleTime: staleTime.standard,
    })
    return { summary: data, isLoading, isError, isRefetching, refetch }
}

export function usePendingIssue(period?: { year: number; month: number }) {
    const { data, isLoading, isError, isRefetching, refetch } = useQuery({
        queryKey: [...FISCAL_MATCH_KEYS.pendingIssue(), period?.year ?? null, period?.month ?? null],
        queryFn: () => fiscalMatchApi.pendingIssue(period),
        staleTime: staleTime.standard,
    })
    return { pendingIssue: data, isLoading, isError, isRefetching, refetch }
}

/** Invalida el cuadre y las listas de RCV/TUU. */
export function useInvalidateFiscalMatch() {
    const qc = useQueryClient()
    return () =>
        Promise.all([
            qc.invalidateQueries({ queryKey: FISCAL_MATCH_KEY }),
            qc.invalidateQueries({ queryKey: RCV_DOCUMENTS_KEY }),
            qc.invalidateQueries({ queryKey: TERMINAL_SALES_KEY }),
        ])
}

/** `id` numérico de un valor con forma de objeto (variables de la acción o grupo resultante). */
function idOf(value: unknown): number | undefined {
    if (typeof value !== 'object' || value === null || !('id' in value)) return undefined
    return typeof value.id === 'number' ? value.id : undefined
}

/** Mutación con `Idempotency-Key` por intención; 409 (motor ocupado) muestra el mensaje del servidor. */
export function useGroupMutation<V, R = unknown>(
    run: (vars: V, key: string) => Promise<R>,
    messages: { success: string; error: string },
) {
    const qc = useQueryClient()
    const invalidate = useInvalidateFiscalMatch()
    const { markLocalMutation } = useRealtime()
    const { keyFor, succeeded, failed } = useIdempotencyKey()
    return useMutation({
        mutationFn: (vars: V) => run(vars, keyFor(vars)),
        onSuccess: (result, vars) => {
            markLocalMutation()
            succeeded()
            toast.success(messages.success)
            // Si la acción deshizo un grupo (unir un huérfano), su detalle ya no existe: se descarta
            // antes de invalidar para no refetchearlo (404 visible) y se resuelve sin esperar la
            // invalidación, así la ficha sigue al grupo resultante de inmediato.
            const from = idOf(vars)
            if (from !== undefined && from !== idOf(result)) qc.removeQueries({ queryKey: FISCAL_MATCH_KEYS.detail(from) })
            void invalidate()
        },
        onError: (e) => {
            failed(e)
            showApiError(e, messages.error)
        },
    })
}

export function useLinkFiscalMatch() {
    return useGroupMutation(
        (v: { id: number; body: FiscalMatchLinkBody }, key) => fiscalMatchApi.link(v.id, v.body, key),
        { success: 'Cuadre actualizado', error: 'No se pudo cuadrar' },
    )
}

export function useUnlinkFiscalMatch() {
    return useGroupMutation(
        (v: { id: number; body: FiscalMatchUnlinkBody }, key) => fiscalMatchApi.unlink(v.id, v.body, key),
        { success: 'Unión quitada', error: 'No se pudo quitar la unión' },
    )
}

export function useReleaseFiscalMatch() {
    return useGroupMutation(
        (v: { id: number }, key) => fiscalMatchApi.release(v.id, key),
        { success: 'Grupo liberado', error: 'No se pudo liberar el grupo' },
    )
}

export function useRetryFiscalIssue() {
    return useGroupMutation(
        (v: { id: number }, key) => fiscalMatchApi.retryIssue(v.id, key),
        { success: 'Emisión reintentada', error: 'No se pudo reintentar la emisión' },
    )
}
