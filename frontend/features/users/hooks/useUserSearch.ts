import { useQuery } from '@tanstack/react-query'
import { usersApi } from "../api/usersApi"
import type { AppUser } from '@/types/entities'
import { USER_KEYS } from './queryKeys'

export function useUserSearch(search: string = "", enabled: boolean = true) {
    const query = useQuery({
        queryKey: USER_KEYS.list(search),
        queryFn: async () => {
            const params = new URLSearchParams()
            if (search) params.append("search", search)
            params.append("limit", "50")

            const res = await usersApi.getUsers({ params: Object.fromEntries(params) })
            return (res.results as AppUser[]) ?? []
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
        queryKey: USER_KEYS.detail(id as string | number),
        queryFn: async () => {
            const data = await usersApi.getUser(id as string | number)
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
