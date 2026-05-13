import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { type AppUser } from "@/types/entities"

export const USERS_QUERY_KEY = ['users']

export function useUsers() {
    const { data: users, isLoading, refetch } = useQuery({
        queryKey: USERS_QUERY_KEY,
        queryFn: async (): Promise<AppUser[]> => {
            const response = await api.get('/core/users/')
            return response.data.results || response.data
        },
    })

    return {
        users: users ?? [],
        isLoading,
        refetch,
    }
}
