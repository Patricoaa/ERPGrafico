import { useState, useCallback } from "react"
import api from "@/lib/api"
import { showApiError } from "@/lib/errors"
import { AppGroup } from "@/types/entities"

interface UseGroupSearchReturn {
    groups: AppGroup[]
    singleGroup: AppGroup | null
    loading: boolean
    fetchGroups: (search?: string) => Promise<void>
    fetchSingleGroup: (id: string | number) => Promise<void>
}

const globalCache: Record<string, AppGroup[]> = {}

export function useGroupSearch(): UseGroupSearchReturn {
    const [groups, setGroups] = useState<AppGroup[]>([])
    const [singleGroup, setSingleGroup] = useState<AppGroup | null>(null)
    const [loading, setLoading] = useState(false)

    const fetchSingleGroup = useCallback(async (id: string | number) => {
        try {
            const res = await api.get(`/core/groups/${id}/`)
            setSingleGroup(res.data)
        } catch (e) {
            console.error("Error fetching single group", e)
        }
    }, [])

    const fetchGroups = useCallback(async (search: string = "") => {
        const cacheKey = search
        if (globalCache[cacheKey]) {
            setGroups(globalCache[cacheKey])
            return
        }

        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (search) params.append("search", search)
            params.append("limit", "50")

            const res = await api.get(`/core/groups/?${params.toString()}`)
            const data = res.data.results || res.data
            
            globalCache[cacheKey] = data
            setGroups(data)
        } catch (err) {
            showApiError(err, "Error al buscar roles")
            setGroups([])
        } finally {
            setLoading(false)
        }
    }, [])

    return { groups, singleGroup, loading, fetchGroups, fetchSingleGroup }
}
