import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { accountingApi } from '../api/accountingApi'
import { LEDGER_QUERY_KEY } from './useLedger'
import { ACCOUNTS_QUERY_KEY } from './useAccounts'
import type { FilterState } from '@/components/shared'

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

export function useJournalEntries(filters?: FilterState) {
    const { data: entries, isLoading, refetch } = useQuery({
        queryKey: [...JOURNAL_ENTRIES_QUERY_KEY, filters],
        queryFn: async () => {
            const params: Record<string, unknown> = {}
            if (filters?.status) params['status'] = filters.status
            if (filters?.search) params['search'] = filters.search
            if (filters?.date_from) params['date_after'] = filters.date_from
            if (filters?.date_to) params['date_before'] = filters.date_to
            const data = await accountingApi.getEntries(params)
            return data.results || data
        },
        staleTime: 2 * 60 * 1000,
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
