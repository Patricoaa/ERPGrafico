"use client"

import { useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { useRealtime } from '@/features/realtime'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { treasuryApi } from '../api/treasuryApi'
import { TERMINAL_SALES_KEYS, TERMINAL_SYNC_KEYS } from './queryKeys'
import type { ManualSyncPayload, TerminalSyncRunFilters, TerminalSyncRunStatus, TerminalSyncSettingsPatch } from '../types'
import { staleTime } from '@/lib/query-config'

/** Mientras una ejecución está en curso, se refresca cada 5 s. */
const POLL_INTERVAL_MS = 5000

const isRunning = (status: TerminalSyncRunStatus | undefined): boolean => status === 'RUNNING'

/**
 * Cuando una ejecución observada pasa de en curso a terminada, refresca lo que pudo cambiar:
 * las ventas sincronizadas y la configuración (su última ejecución).
 */
function useRefreshOnFinish(rows: ReadonlyArray<{ id: number; status: TerminalSyncRunStatus }> | undefined) {
    const queryClient = useQueryClient()
    const active = useRef<Set<number>>(new Set())

    useEffect(() => {
        if (!rows) return
        const finished = rows.some((row) => active.current.has(row.id) && !isRunning(row.status))
        active.current = new Set(rows.filter((row) => isRunning(row.status)).map((row) => row.id))
        if (finished) {
            invalidateCrossFeature(queryClient, [TERMINAL_SALES_KEYS.all, TERMINAL_SYNC_KEYS.settings()])
        }
    }, [rows, queryClient])
}

export function useTerminalSyncRuns(filters: TerminalSyncRunFilters = {}) {
    const { page = 1, page_size = 20, ...rest } = filters
    const params: TerminalSyncRunFilters = { ...rest, page, page_size }

    const { data, isLoading, isFetching, isError, refetch } = useQuery({
        queryKey: [...TERMINAL_SYNC_KEYS.runs(), 'list', params],
        queryFn: () => treasuryApi.getTerminalSyncRuns(params),
        staleTime: staleTime.volatile,
        refetchInterval: (query) => (query.state.data?.results.some((row) => isRunning(row.status)) ? POLL_INTERVAL_MS : false),
    })
    useRefreshOnFinish(data?.results)

    return {
        page: data,
        runs: data?.results ?? [],
        totalCount: data?.count ?? 0,
        isLoading,
        isRefetching: isFetching && !isLoading,
        isError,
        refetch,
    }
}

export function useTerminalSyncRun(id: number | null | undefined) {
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: TERMINAL_SYNC_KEYS.run(id ?? 0),
        queryFn: () => treasuryApi.getTerminalSyncRun(id as number),
        enabled: id != null,
        staleTime: staleTime.volatile,
        refetchInterval: (query) => (isRunning(query.state.data?.status) ? POLL_INTERVAL_MS : false),
    })
    const observed = useMemo(() => (data ? [data] : undefined), [data])
    useRefreshOnFinish(observed)

    return { run: data, isLoading, isError, refetch }
}

/**
 * Disparo manual de sincronización. `Idempotency-Key` por intención: se conserva con el mismo payload
 * mientras el desenlace sea incierto (reintento / doble clic) y se renueva tras éxito o rechazo.
 */
export function useStartTerminalSync() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const { keyFor, succeeded, failed } = useIdempotencyKey()

    const mutation = useMutation({
        mutationFn: (payload: ManualSyncPayload = {}) => {
            return treasuryApi.startTerminalSync(payload, keyFor(payload))
        },
        onSuccess: () => {
            markLocalMutation()
            succeeded()
            invalidateCrossFeature(queryClient, [TERMINAL_SALES_KEYS.all, TERMINAL_SYNC_KEYS.runs(), TERMINAL_SYNC_KEYS.settings()])
            toast.success('Sincronización en curso')
        },
        onError: (err) => {
            failed(err)
            showApiError(err, 'Error al iniciar la sincronización')
        },
    })

    return { startSync: mutation.mutateAsync, isStarting: mutation.isPending }
}

export function useTerminalSyncSettings() {
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: TERMINAL_SYNC_KEYS.settings(),
        queryFn: () => treasuryApi.getTerminalSyncSettings(),
        staleTime: staleTime.stable,
    })

    return { settings: data, isLoading, isError, refetch }
}

export function useUpdateTerminalSyncSettings() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const mutation = useMutation({
        mutationFn: (patch: TerminalSyncSettingsPatch) => treasuryApi.updateTerminalSyncSettings(patch),
        onSuccess: () => {
            markLocalMutation()
            invalidateCrossFeature(queryClient, [TERMINAL_SYNC_KEYS.settings()])
            toast.success('Configuración de sincronización guardada')
        },
        onError: (err) => showApiError(err, 'Error al guardar la configuración'),
    })

    return { updateSettings: mutation.mutateAsync, isUpdating: mutation.isPending }
}
