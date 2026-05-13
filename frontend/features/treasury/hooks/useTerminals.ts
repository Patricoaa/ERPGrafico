import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { treasuryApi } from '../api/treasuryApi'
import type { Terminal, TerminalUpdatePayload } from '../types'

import { TERMINALS_QUERY_KEY } from './queryKeys'

export { TERMINALS_QUERY_KEY }

interface UseTerminalsReturn {
    terminals: Terminal[]
    refetch: () => Promise<unknown>
    toggleActive: (terminal: Terminal) => Promise<void>
    deleteTerminal: (terminal: Terminal) => Promise<void>
    isLoading: boolean
}

/**
 * Custom hook for managing POS terminals using React Query
 */
export function useTerminals(): UseTerminalsReturn {
    const queryClient = useQueryClient()

    const { data: terminals, isLoading, refetch } = useQuery({
        queryKey: TERMINALS_QUERY_KEY,
        queryFn: treasuryApi.getTerminals,
        staleTime: 5 * 60 * 1000, // 5 min
    })

    const toggleActiveMutation = useMutation({
        mutationFn: async (terminal: Terminal) => {
            const payload: TerminalUpdatePayload = {
                is_active: !terminal.is_active
            }
            return treasuryApi.updateTerminal(terminal.id, payload)
        },
        onSuccess: (_, terminal) => {
            toast.success(terminal.is_active ? 'Terminal desactivado' : 'Terminal activado')
            queryClient.invalidateQueries({ queryKey: TERMINALS_QUERY_KEY })
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
            toast.success('Terminal eliminado correctamente')
            queryClient.invalidateQueries({ queryKey: TERMINALS_QUERY_KEY })
        },
        onError: (err: Error & { response?: { data?: { error?: string } } }) => {
            const errorMsg = err.response?.data?.error || 'Error al eliminar terminal'
            toast.error(errorMsg)
        }
    })

    return {
        terminals: terminals ?? [],
        refetch,
        toggleActive: toggleActiveMutation.mutateAsync,
        deleteTerminal: deleteMutation.mutateAsync,
        isLoading,
    }
}
