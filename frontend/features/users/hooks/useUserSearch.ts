import { useQuery } from '@tanstack/react-query'
import { usersApi } from "../api/usersApi"
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

            const data = await usersApi.getUsers({ params, signal } as any)
            return data as AppUser[]
        },
        enabled,
        staleTime: 5 * 60 * 1000,
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
            const data = await usersApi.getUser(id!)
            return data as AppUser
        },
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    })

    return {
        user: query.data ?? null,
        loading: query.isLoading,
    }
}
