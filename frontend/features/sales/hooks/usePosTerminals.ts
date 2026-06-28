import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { treasuryApi, TERMINALS_KEYS } from '@/features/treasury'
import { useRealtime } from '@/features/realtime'
import type { Terminal, TerminalUpdatePayload } from '@/features/treasury'

export { TERMINALS_KEYS }

interface UsePosTerminalsReturn {
    terminals: Terminal[]
    refetch: () => Promise<unknown>
    toggleActive: (terminal: Terminal) => Promise<void>
    deleteTerminal: (terminal: Terminal) => Promise<void>
    isLoading: boolean
}

export function usePosTerminals(): UsePosTerminalsReturn {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: terminals, isLoading, refetch } = useQuery({
        queryKey: TERMINALS_KEYS.lists(),
        queryFn: treasuryApi.getTerminals,
        staleTime: 5 * 60 * 1000,
    })

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: TERMINALS_KEYS.lists() })
        queryClient.invalidateQueries({ queryKey: TERMINALS_KEYS.details() })
    }

    const toggleActiveMutation = useMutation({
        mutationFn: async (terminal: Terminal) => {
            const payload: TerminalUpdatePayload = {
                is_active: !terminal.is_active
            }
            return treasuryApi.updateTerminal(terminal.id, payload)
        },
        onSuccess: (_, terminal) => {
            markLocalMutation()
            toast.success(terminal.is_active ? 'Terminal desactivado' : 'Terminal activado')
            invalidate()
        },
        onError: () => {
            toast.error('Error al actualizar terminal')
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (terminal: Terminal) => {
            return treasuryApi.deleteTerminal(terminal.id)
        },
        onSuccess: () => {
            markLocalMutation()
            toast.success('Terminal eliminado correctamente')
            invalidate()
        },
        onError: (err: Error & { response?: { data?: { error?: string } } }) => {
            const errorMsg = err.response?.data?.error || 'Error al eliminar terminal'
            toast.error(errorMsg)
        }
    })

    return {
        terminals: terminals ?? [],
        refetch,
    toggleActive: async (terminal: Terminal) => { await toggleActiveMutation.mutateAsync(terminal); },
    deleteTerminal: async (terminal: Terminal) => { await deleteMutation.mutateAsync(terminal); },
        isLoading,
    }
}
