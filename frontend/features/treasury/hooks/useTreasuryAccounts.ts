import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { treasuryApi } from '../api/treasuryApi'
import type { TreasuryAccount } from '../types'

interface UseTreasuryAccountsReturn {
    accounts: TreasuryAccount[]
    loading: boolean
    error: Error | null
    refetch: () => Promise<void>
    deleteAccount: (id: number) => Promise<void>
}

/**
 * Custom hook for managing treasury accounts
 * Handles fetching and deleting accounts with automatic state management
 */
export function useTreasuryAccounts(): UseTreasuryAccountsReturn {
    const [accounts, setAccounts] = useState<TreasuryAccount[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchAccounts = useCallback(async (): Promise<void> => {
        try {
            setLoading(true)
            setError(null)
            const data = await treasuryApi.getAccounts()
            setAccounts(data)
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to fetch accounts')
            setError(error)
            toast.error('Error al cargar cuentas')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchAccounts()
    }, [fetchAccounts])

    const deleteAccount = useCallback(async (id: number): Promise<void> => {
        if (!confirm('¿Está seguro de eliminar esta cuenta?')) {
            return
        }

        try {
            await treasuryApi.deleteAccount(id)
            toast.success('Cuenta eliminada')
            await fetchAccounts()
        } catch (error) {
            toast.error('Error al eliminar')
            throw error
        }
    }, [fetchAccounts])

    return {
        accounts,
        loading,
        error,
        refetch: fetchAccounts,
        deleteAccount,
    }
}
