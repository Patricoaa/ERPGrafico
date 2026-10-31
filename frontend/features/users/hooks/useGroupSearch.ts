import { useQuery } from '@tanstack/react-query'
import { usersApi } from "../api/usersApi"
import type { AppGroup } from '@/types/entities'
import { GROUP_KEYS } from './queryKeys'
import { staleTime } from '@/lib/query-config'

function extractGroups(data: { results?: AppGroup[] } | AppGroup[]): AppGroup[] {
    if (Array.isArray(data)) return data
    return data.results ?? []
}

export function useGroupSearch(search: string = "", enabled: boolean = true, kind?: 'ROLE' | 'TEAM') {
    const query = useQuery({
        queryKey: GROUP_KEYS.list({ search, kind }),
        queryFn: async () => {
            const params: Record<string, unknown> = { limit: 50 }
            if (search) params.search = search
            if (kind) params.kind = kind

            const data = await usersApi.getGroups(params as Parameters<typeof usersApi.getGroups>[0])
            return extractGroups(data)
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
