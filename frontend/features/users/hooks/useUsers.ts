import { useQuery } from '@tanstack/react-query'
import { usersApi } from "../api/usersApi"
import { type AppUser } from "@/types/entities"
import { USER_KEYS } from './queryKeys'
import type { FilterState } from '@/components/shared'

export function useUsers(filters?: FilterState) {
    const { data: users, isLoading, refetch } = useQuery({
        queryKey: [...USER_KEYS.lists(), filters],
        queryFn: async (): Promise<AppUser[]> => {
            return await usersApi.getUsers({ params: filters })
        },
        staleTime: 10 * 60 * 1000,
    })

    return {
        users: users ?? [],
        isLoading,
        refetch,
    }
}
