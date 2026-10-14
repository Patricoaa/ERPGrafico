import { useQuery } from '@tanstack/react-query'
import { usersApi } from "../api/usersApi"
import type { AppGroup } from '@/types/entities'
import { GROUP_KEYS } from './queryKeys'
import { staleTime } from '@/lib/query-config'

export function useGroupSearch(search: string = "", enabled: boolean = true) {
    const query = useQuery({
        queryKey: GROUP_KEYS.list({ search }),
        queryFn: async () => {
            const params = new URLSearchParams()
            if (search) params.append("search", search)
            params.append("limit", "50")

            const data = await usersApi.getGroups({ params: Object.fromEntries(params) })
            return data as AppGroup[]
        },
        enabled,
        staleTime: staleTime.stable,
    })

    return {
        groups: query.data ?? [],
        loading: query.isLoading,
        isFetching: query.isFetching,
    }
}

export function useSingleGroup(id: string | number | null) {
    const query = useQuery({
        queryKey: GROUP_KEYS.detail(id as string | number),
        queryFn: async () => {
            const data = await usersApi.getGroup(id as string | number)
            return data as AppGroup
        },
        enabled: !!id,
        staleTime: staleTime.stable,
    })

    return {
        group: query.data ?? null,
        loading: query.isLoading,
    }
}
