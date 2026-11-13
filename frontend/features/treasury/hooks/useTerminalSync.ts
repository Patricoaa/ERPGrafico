import { useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { useRealtime } from '@/features/realtime'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { shouldKeepIdempotencyKey } from '@/lib/idempotency'
import { generateUuidV4 } from '@/lib/uuid'
import { treasuryApi } from '../api/treasuryApi'
import { TERMINAL_SALES_KEYS, TERMINAL_SYNC_KEYS } from './queryKeys'
import type { ManualSyncPayload, TerminalSyncRunFilters, TerminalSyncSettingsPatch } from '../types'
import { staleTime } from '@/lib/query-config'

export function useTerminalSyncRuns(filters: TerminalSyncRunFilters = {}) {
    const { page = 1, page_size = 20, ...rest } = filters
    const params: TerminalSyncRunFilters = { ...rest, page, page_size }

    const { data, isLoading, isFetching, isError, refetch } = useQuery({
        queryKey: [...TERMINAL_SYNC_KEYS.runs(), params],
        queryFn: () => treasuryApi.getTerminalSyncRuns(params),
        staleTime: staleTime.volatile,
    })

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

/**
 * Disparo manual de sincronización. `Idempotency-Key` por intención: se conserva con el mismo payload
 * mientras el desenlace sea incierto (reintento / doble clic) y se renueva tras éxito o rechazo.
 */
export function useStartTerminalSync() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const keyRef = useRef<{ key: string; signature: string } | null>(null)

    const mutation = useMutation({
        mutationFn: (payload: ManualSyncPayload = {}) => {
            const signature = JSON.stringify(payload)
            if (keyRef.current?.signature !== signature) keyRef.current = { key: generateUuidV4(), signature }
            return treasuryApi.startTerminalSync(payload, keyRef.current.key)
        },
        onSuccess: () => {
            markLocalMutation()
            keyRef.current = null
            invalidateCrossFeature(queryClient, [TERMINAL_SALES_KEYS.all, TERMINAL_SYNC_KEYS.runs()])
            toast.success('Sincronización en curso')
        },
        onError: (err) => {
            if (!shouldKeepIdempotencyKey(err)) keyRef.current = null
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
