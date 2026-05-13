import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { AppGroup } from '@/types/entities'

export const GROUP_KEYS = {
    all: ['groups'] as const,
    search: (term: string) => [...GROUP_KEYS.all, 'search', term] as const,
    detail: (id: string | number) => [...GROUP_KEYS.all, 'detail', id] as const,
}

export function useGroupSearch(search: string = "", enabled: boolean = true) {
    const query = useQuery({
        queryKey: GROUP_KEYS.search(search),
        queryFn: async ({ signal }) => {
            const params = new URLSearchParams()
            if (search) params.append("search", search)
            params.append("limit", "50")

            const res = await api.get(`/core/groups/?${params.toString()}`, { signal })
            return (res.data.results || res.data) as AppGroup[]
        },
        enabled,
        staleTime: 5 * 60 * 1000, // 5 min
    })

    return {
        groups: query.data ?? [],
        loading: query.isLoading,
        isFetching: query.isFetching,
    }
}

export function useSingleGroup(id: string | number | null) {
    const query = useQuery({
        queryKey: GROUP_KEYS.detail(id!),
        queryFn: async ({ signal }) => {
            const res = await api.get(`/core/groups/${id}/`, { signal })
            return res.data as AppGroup
        },
        enabled: !!id,
        staleTime: 5 * 60 * 1000, // 5 min
    })

    return {
        group: query.data ?? null,
        loading: query.isLoading,
    }
}
