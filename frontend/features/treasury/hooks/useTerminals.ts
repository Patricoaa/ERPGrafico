import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { treasuryApi } from '../api/treasuryApi'
import type { Terminal, TerminalUpdatePayload } from '../types'

interface UseTerminalsReturn {
    terminals: Terminal[]
    loading: boolean
    error: Error | null
    refetch: () => Promise<void>
    toggleActive: (terminal: Terminal) => Promise<void>
    deleteTerminal: (terminal: Terminal) => Promise<void>
}

/**
 * Custom hook for managing POS terminals
 * Handles fetching, updating, and deleting terminals with automatic state management
 */
export function useTerminals(): UseTerminalsReturn {
    const [terminals, setTerminals] = useState<Terminal[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchTerminals = useCallback(async (): Promise<void> => {
        try {
            setLoading(true)
            setError(null)
            const data = await treasuryApi.getTerminals()
            setTerminals(data)
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to fetch terminals')
            setError(error)
            toast.error('Error al cargar terminales')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchTerminals()
    }, [fetchTerminals])

    const toggleActive = useCallback(async (terminal: Terminal): Promise<void> => {
        try {
            const payload: TerminalUpdatePayload = {
                is_active: !terminal.is_active
            }
            await treasuryApi.updateTerminal(terminal.id, payload)
            toast.success(terminal.is_active ? 'Terminal desactivado' : 'Terminal activado')
            await fetchTerminals()
        } catch (error) {
            toast.error('Error al actualizar terminal')
            throw error
        }
    }, [fetchTerminals])

    const deleteTerminal = useCallback(async (terminal: Terminal): Promise<void> => {
        if (!confirm(`¿Está seguro que desea eliminar el terminal "${terminal.name}"?`)) {
            return
        }

        try {
            await treasuryApi.deleteTerminal(terminal.id)
            toast.success('Terminal eliminado correctamente')
            await fetchTerminals()
        } catch (err) {
            const error = err as { response?: { data?: { error?: string } } }
            const errorMsg = error.response?.data?.error || 'Error al eliminar terminal'
            toast.error(errorMsg)
            throw error
        }
    }, [fetchTerminals])

    return {
        terminals,
        loading,
        error,
        refetch: fetchTerminals,
        toggleActive,
        deleteTerminal,
    }
}
