import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { showApiError } from '@/lib/errors'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { staleTime } from '@/lib/query-config'
import { useRealtime } from '@/features/realtime'
import { rcvApi } from '../api/rcvApi'
import { RCV_KEYS } from './queryKeys'
import type { RcvImportFilters, RcvImportStatus, StartRcvImportPayload } from '../types'

/** Mientras una importación está en cola o corriendo, se refresca cada 5 s. */
const POLL_INTERVAL_MS = 5000

function isInProgress(status: RcvImportStatus | undefined): boolean {
    return status === 'QUEUED' || status === 'RUNNING'
}

export function useRcvImports(filters: RcvImportFilters = {}) {
    const { page = 1, page_size = 20, ...rest } = filters
    const params: RcvImportFilters = { ...rest, page, page_size }

    const { data, isLoading, isFetching, isError, refetch } = useQuery({
        queryKey: [...RCV_KEYS.imports(), 'list', params],
        queryFn: () => rcvApi.getImports(params),
        staleTime: staleTime.volatile,
        refetchInterval: (query) => (query.state.data?.results.some((row) => isInProgress(row.status)) ? POLL_INTERVAL_MS : false),
    })

    return {
        page: data,
        imports: data?.results ?? [],
        totalCount: data?.count ?? 0,
        isLoading,
        isRefetching: isFetching && !isLoading,
        isError,
        refetch,
    }
}

export function useRcvImport(id: number | null | undefined) {
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: RCV_KEYS.import(id ?? 0),
        queryFn: () => rcvApi.getImport(id as number),
        enabled: id != null,
        staleTime: staleTime.volatile,
        refetchInterval: (query) => (isInProgress(query.state.data?.status) ? POLL_INTERVAL_MS : false),
    })

    return { rcvImport: data, isLoading, isError, refetch }
}

/**
 * Disparo manual de importación. `Idempotency-Key` por intención: se conserva con el mismo payload
 * mientras el desenlace sea incierto (reintento / doble clic) y se renueva tras éxito o rechazo.
 */
export function useStartRcvImport() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const { keyFor, succeeded, failed } = useIdempotencyKey()

    const mutation = useMutation({
        mutationFn: (payload: StartRcvImportPayload) => rcvApi.startImport(payload, keyFor(payload)),
        onSuccess: () => {
            markLocalMutation()
            succeeded()
            invalidateCrossFeature(queryClient, [RCV_KEYS.all])
            toast.success('Importación en curso')
        },
        onError: (err) => {
            failed(err)
            showApiError(err, 'Error al iniciar la importación')
        },
    })

    return { startImport: mutation.mutateAsync, isStarting: mutation.isPending }
}
