import { useQuery } from '@tanstack/react-query'
import { usersApi } from "../api/usersApi"
import { USER_KEYS } from './queryKeys'
import type { FilterState } from '@/components/shared'

export function useUsers(filters?: FilterState & { page?: number; page_size?: number }) {
    const { page = 1, page_size = 50, ...restFilters } = filters || {}
    const activeFilters = { page, page_size, ...restFilters }

    const { data: pageData, isLoading, refetch } = useQuery({
        queryKey: [...USER_KEYS.lists(), activeFilters],
        queryFn: async () => {
            return await usersApi.getUsers(activeFilters)
        },
        staleTime: 10 * 60 * 1000,
    })

    return {
        page: pageData,
        users: pageData?.results ?? [],
        isLoading,
        refetch,
    }
}
