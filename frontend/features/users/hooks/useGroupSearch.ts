import { useQuery } from '@tanstack/react-query'
import { usersApi } from "../api/usersApi"
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

            const data = await usersApi.getGroups({ params, signal } as any)
            return (data.results || data) as AppGroup[]
        },
        enabled,
        staleTime: 5 * 60 * 1000,
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
            const data = await usersApi.getGroup(id!)
            return data as AppGroup
        },
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    })

    return {
        group: query.data ?? null,
        loading: query.isLoading,
    }
}
