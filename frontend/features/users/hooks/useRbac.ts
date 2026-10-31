import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { rbacApi, type Composition } from "../api/rbacApi"

export const rbacKeys = {
    bundles: () => ["rbac", "bundles"] as const,
    composition: (id: number) => ["rbac", "composition", id] as const,
}

export function useBundles() {
    return useQuery({
        queryKey: rbacKeys.bundles(),
        queryFn: rbacApi.getBundles,
        staleTime: 5 * 60_000,
    })
}

export function useComposition(groupId: number) {
    return useQuery({
        queryKey: rbacKeys.composition(groupId),
        queryFn: () => rbacApi.getComposition(groupId),
        enabled: groupId > 0,
    })
}

export function useSaveComposition() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({
            groupId,
            data,
        }: {
            groupId: number
            data: Omit<Composition, "effective_permissions">
        }) => rbacApi.setComposition(groupId, data),
        onSuccess: (_result, { groupId }) => {
            void qc.invalidateQueries({ queryKey: rbacKeys.composition(groupId) })
        },
    })
}
