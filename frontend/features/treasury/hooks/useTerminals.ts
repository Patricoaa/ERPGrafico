import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { treasuryApi } from '../api/treasuryApi'
import type { Terminal, TerminalUpdatePayload } from '../types'

export const TERMINALS_QUERY_KEY = ['terminals']

interface UseTerminalsReturn {
    terminals: Terminal[]
    refetch: () => Promise<any>
    toggleActive: (terminal: Terminal) => Promise<void>
    deleteTerminal: (terminal: Terminal) => Promise<void>
    isLoading: boolean
}

/**
 * Custom hook for managing POS terminals using React Query
 */
export function useTerminals(): UseTerminalsReturn {
    const queryClient = useQueryClient()

    const { data: terminals = [], refetch, isLoading } = useQuery({
        queryKey: TERMINALS_QUERY_KEY,
        queryFn: treasuryApi.getTerminals,
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
        onError: (err: any) => {
            const errorMsg = err.response?.data?.error || 'Error al eliminar terminal'
            toast.error(errorMsg)
        }
    })

    const toggleActive = async (terminal: Terminal) => {
        await toggleActiveMutation.mutateAsync(terminal)
    }

    const deleteTerminal = async (terminal: Terminal) => {
        await deleteMutation.mutateAsync(terminal)
    }

    return {
        terminals,
        refetch,
        toggleActive,
        deleteTerminal,
        isLoading
    }
}
