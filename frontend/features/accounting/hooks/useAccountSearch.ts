import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Account } from '@/types/entities'

import { ACCOUNT_KEYS } from './queryKeys'

export { ACCOUNT_KEYS }

export function useAccountSearch(search: string = "", isLeaf: boolean = false, enabled: boolean = true) {
    const query = useQuery({
        queryKey: ACCOUNT_KEYS.search(search, isLeaf),
        queryFn: async ({ signal }) => {
            const params = new URLSearchParams()
            if (search) params.append("search", search)
            if (isLeaf) params.append("is_leaf", "true")
            if (search) params.append("limit", "50")

            const res = await api.get(`/accounting/accounts/?${params.toString()}`, { signal })
            return (res.data.results || res.data) as Account[]
        },
        enabled,
        staleTime: 5 * 60 * 1000, // 5 min
    })

    return {
        accounts: query.data ?? [],
        loading: query.isLoading,
        isFetching: query.isFetching,
    }
}

export function useSingleAccount(id: string | number | null) {
    const query = useQuery({
        queryKey: ACCOUNT_KEYS.detail(id!),
        queryFn: async ({ signal }) => {
            const res = await api.get(`/accounting/accounts/${id}/`, { signal })
            return res.data as Account
        },
        enabled: !!id,
        staleTime: 5 * 60 * 1000, // 5 min
    })

    return {
        account: query.data ?? null,
        loading: query.isLoading,
    }
}
