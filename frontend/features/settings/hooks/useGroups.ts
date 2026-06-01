"use client"

import { useState, useEffect, useCallback } from "react"
import { settingsApi } from "../api/settingsApi"
import { toast } from "sonner"
import type { Group } from "../api/types"

export function useGroups() {
    const [groups, setGroups] = useState<Group[]>([])
    const [loading, setLoading] = useState(true)

    const fetchGroups = useCallback(async () => {
        setLoading(true)
        try {
            const data = await settingsApi.getGroups()
            setGroups(data)
        } catch {
            toast.error("Error al cargar grupos")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchGroups()
    }, [fetchGroups])

    const deleteGroup = useCallback(async (id: number): Promise<boolean> => {
        try {
            await settingsApi.deleteGroup(id)
            toast.success("Grupo eliminado correctamente")
            await fetchGroups()
            return true
        } catch {
            toast.error("Error al eliminar grupo")
            return false
        }
    }, [fetchGroups])

    return { groups, loading, fetchGroups, deleteGroup }
}
