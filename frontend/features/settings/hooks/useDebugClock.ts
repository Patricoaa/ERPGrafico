import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useRealtime } from "@/features/realtime"
import { debugApi, type DebugClockState } from "../api/debugApi"
import { getErrorMessage } from "@/lib/errors"

export const DEBUG_CLOCK_QUERY_KEY = ["debug-clock"] as const
const SERVER_TIME_QUERY_KEY = ["server-time"] as const

interface UseDebugClockReturn {
    clock: DebugClockState | undefined
    isLoading: boolean
    isError: boolean
    refetch: () => Promise<unknown>
    setClock: (datetime: string) => Promise<DebugClockState>
    resetClock: () => Promise<void>
    isSaving: boolean
}

export function useDebugClock(enabled = true): UseDebugClockReturn {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: DEBUG_CLOCK_QUERY_KEY,
        queryFn: () => debugApi.getClock(),
        enabled,
        retry: false,
    })

    const invalidate = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: SERVER_TIME_QUERY_KEY }),
            queryClient.invalidateQueries({ queryKey: DEBUG_CLOCK_QUERY_KEY }),
        ])
    }

    const setMutation = useMutation({
        mutationFn: (datetime: string) => debugApi.setClock(datetime),
        onSuccess: async () => {
            markLocalMutation()
            toast.success("Reloj de depuración fijado")
            await invalidate()
        },
        onError: (error: unknown) => toast.error(getErrorMessage(error)),
    })

    const resetMutation = useMutation({
        mutationFn: () => debugApi.resetClock(),
        onSuccess: async () => {
            markLocalMutation()
            toast.success("Reloj restablecido a la hora real")
            await invalidate()
        },
        onError: (error: unknown) => toast.error(getErrorMessage(error)),
    })

    return {
        clock: data,
        isLoading,
        isError,
        refetch,
        setClock: setMutation.mutateAsync,
        resetClock: resetMutation.mutateAsync,
        isSaving: setMutation.isPending || resetMutation.isPending,
    }
}
