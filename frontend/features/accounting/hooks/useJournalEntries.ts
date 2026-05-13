import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { accountingApi } from '../api/accountingApi'
import { LEDGER_QUERY_KEY } from './useLedger'
import { ACCOUNTS_QUERY_KEY } from './useAccounts'

import { JOURNAL_ENTRIES_QUERY_KEY } from './queryKeys'

export { JOURNAL_ENTRIES_QUERY_KEY }

export interface JournalEntry {
    id: number
    number: string
    date: string
    description: string
    reference: string
    state: string
    source_documents?: {
        type: string
        id: number | string
        name: string
        url: string
    }[]
}

export function useJournalEntries() {
    const { data: entries, isLoading, refetch } = useQuery({
        queryKey: JOURNAL_ENTRIES_QUERY_KEY,
        queryFn: async () => {
            const data = await accountingApi.getEntries()
            return data.results || data
        },
        staleTime: 2 * 60 * 1000, // 2 min
    })

    return {
        entries: entries ?? [],
        isLoading,
        refetch,
    }
}

export function useDeleteJournalEntry(options?: { onSuccess?: () => void }) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: number) => accountingApi.deleteEntry(id),
        onSuccess: () => {
            // A deleted entry changes the ledger view, the journal list, AND account balances
            queryClient.invalidateQueries({ queryKey: [LEDGER_QUERY_KEY] })
            queryClient.invalidateQueries({ queryKey: JOURNAL_ENTRIES_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY })
            toast.success('Asiento eliminado correctamente')
            options?.onSuccess?.()
        },
        onError: (error: Error) => showApiError(error, 'Error al eliminar el asiento'),
    })
}
