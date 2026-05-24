import { useQuery } from '@tanstack/react-query'
import { usersApi } from "../api/usersApi"
import { type AppUser } from "@/types/entities"
import { USER_KEYS } from './queryKeys'

export function useUsers() {
    const { data: users, isLoading, refetch } = useQuery({
        queryKey: USER_KEYS.lists(),
        queryFn: async (): Promise<AppUser[]> => {
            return await usersApi.getUsers()
        },
        staleTime: 10 * 60 * 1000,
    })

    return {
        users: users ?? [],
        isLoading,
        refetch,
    }
}
