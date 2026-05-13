import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { AppUser } from '@/types/entities'

export const USER_KEYS = {
    all: ['users'] as const,
    search: (term: string) => [...USER_KEYS.all, 'search', term] as const,
    detail: (id: string | number) => [...USER_KEYS.all, 'detail', id] as const,
}

export function useUserSearch(search: string = "", enabled: boolean = true) {
    const query = useQuery({
        queryKey: USER_KEYS.search(search),
        queryFn: async ({ signal }) => {
            const params = new URLSearchParams()
            if (search) params.append("search", search)
            params.append("limit", "50")

            const res = await api.get(`/core/users/?${params.toString()}`, { signal })
            return (res.data.results || res.data) as AppUser[]
        },
        enabled,
        staleTime: 5 * 60 * 1000, // 5 min
    })

    return {
        users: query.data ?? [],
        loading: query.isLoading,
        isFetching: query.isFetching,
    }
}

export function useSingleUser(id: string | number | null) {
    const query = useQuery({
        queryKey: USER_KEYS.detail(id!),
        queryFn: async ({ signal }) => {
            const res = await api.get(`/core/users/${id}/`, { signal })
            return res.data as AppUser
        },
        enabled: !!id,
        staleTime: 5 * 60 * 1000, // 5 min
    })

    return {
        user: query.data ?? null,
        loading: query.isLoading,
    }
}
