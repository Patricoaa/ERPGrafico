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
    display_id: string
    date: string
    description: string
    status: string
    is_manual: boolean
    reversal_of?: {
        id: number
        display_id: string
    } | null
    items?: Array<{
        id: number
        account: number
        account_code: string
        account_name: string
        partner: number | null
        label: string
        debit: number
        credit: number
    }>
    source_documents?: {
        type: string
        id: number
        name: string
        url?: string
        content_type_id?: number
        object_id?: number
        display?: string
    }[]
}

export function useJournalEntry(id: string | number | undefined) {
    return useQuery({
        queryKey: [...JOURNAL_ENTRIES_QUERY_KEY, 'detail', id],
        queryFn: async () => {
            const data = await accountingApi.getEntry(id as string | number)
            return data
        },
        enabled: !!id,
    })
}

export function useJournalEntries(filters?: FilterState & { page?: number; page_size?: number }) {
    const { page = 1, page_size = 50, ...restFilters } = filters || {}
    const { data: pageData, isLoading, refetch } = useQuery({
        queryKey: [...JOURNAL_ENTRIES_QUERY_KEY, { page, page_size, ...restFilters }],
        queryFn: async () => {
            const params: Record<string, unknown> = { page, page_size }
            if (restFilters?.status) params['status'] = restFilters.status
            if (restFilters?.search) params['search'] = restFilters.search
            if (restFilters?.date_from) params['date_after'] = restFilters.date_from
            if (restFilters?.date_to) params['date_before'] = restFilters.date_to
            if (restFilters?.date_after) params['date_after'] = restFilters.date_after
            if (restFilters?.date_before) params['date_before'] = restFilters.date_before
            return await accountingApi.getEntries(params)
        },
        staleTime: 2 * 60 * 1000,
    })

    return {
        page: pageData,
        entries: (pageData?.results ?? []) as JournalEntry[],
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
