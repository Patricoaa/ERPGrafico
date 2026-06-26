"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi } from "../api/settingsApi"
import { toast } from "sonner"
import { useRealtime } from '@/features/realtime'
import type { Group } from "../api/types"

export const GROUPS_QUERY_KEY = ['groups']

export function useGroups() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: groups = [], isLoading } = useQuery({
        queryKey: GROUPS_QUERY_KEY,
        queryFn: settingsApi.getGroups,
        staleTime: 10 * 60 * 1000,
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => settingsApi.deleteGroup(id),
        onSuccess: () => {
            markLocalMutation()
            toast.success("Grupo eliminado correctamente")
            queryClient.invalidateQueries({ queryKey: GROUPS_QUERY_KEY })
        },
        onError: () => {
            toast.error("Error al eliminar grupo")
        }
    })

    return {
        groups,
        loading: isLoading,
        fetchGroups: () => queryClient.invalidateQueries({ queryKey: GROUPS_QUERY_KEY }),
        deleteGroup: deleteMutation.mutateAsync,
    }
}
