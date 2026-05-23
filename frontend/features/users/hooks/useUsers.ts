import { useQuery } from '@tanstack/react-query'
import { usersApi } from "../api/usersApi"
import { type AppUser } from "@/types/entities"

export const USERS_QUERY_KEY = ['users']

export function useUsers() {
    const { data: users, isLoading, refetch } = useQuery({
        queryKey: USERS_QUERY_KEY,
        queryFn: async (): Promise<AppUser[]> => {
            const data = await usersApi.getUsers()
            return data.results || data
        },
        staleTime: 10 * 60 * 1000,
    })

    return {
        users: users ?? [],
        isLoading,
        refetch,
    }
}
