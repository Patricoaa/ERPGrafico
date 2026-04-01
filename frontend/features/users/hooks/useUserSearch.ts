import { useState, useCallback } from "react"
import api from "@/lib/api"
import { showApiError } from "@/lib/errors"
import { AppUser } from "@/types/entities"

interface UseUserSearchReturn {
    users: AppUser[]
    singleUser: AppUser | null
    loading: boolean
    fetchUsers: (search?: string) => Promise<void>
    fetchSingleUser: (id: string | number) => Promise<void>
}

let globalCache: Record<string, AppUser[]> = {}

export function useUserSearch(): UseUserSearchReturn {
    const [users, setUsers] = useState<AppUser[]>([])
    const [singleUser, setSingleUser] = useState<AppUser | null>(null)
    const [loading, setLoading] = useState(false)

    const fetchSingleUser = useCallback(async (id: string | number) => {
        try {
            const res = await api.get(`/core/users/${id}/`)
            setSingleUser(res.data)
        } catch (e) {
            console.error("Error fetching single user", e)
        }
    }, [])

    const fetchUsers = useCallback(async (search: string = "") => {
        const cacheKey = search
        if (globalCache[cacheKey]) {
            setUsers(globalCache[cacheKey])
            return
        }

        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (search) params.append("search", search)
            params.append("limit", "50")

            const res = await api.get(`/core/users/?${params.toString()}`)
            const data = res.data.results || res.data
            
            globalCache[cacheKey] = data
            setUsers(data)
        } catch (err) {
            showApiError(err, "Error al buscar usuarios")
            setUsers([])
        } finally {
            setLoading(false)
        }
    }, [])

    return { users, singleUser, loading, fetchUsers, fetchSingleUser }
}
