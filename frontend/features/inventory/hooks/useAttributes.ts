import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface Attribute {
    id: number
    name: string
    code: string
    value_type: 'text' | 'number' | 'date' | 'boolean'
    is_required: boolean
    active: boolean
}

export const ATTRIBUTES_QUERY_KEY = ['inventoryAttributes']

export function useAttributes() {
    const queryClient = useQueryClient()

    const { data: attributes, refetch } = useSuspenseQuery({
        queryKey: ATTRIBUTES_QUERY_KEY,
        queryFn: async (): Promise<Attribute[]> => {
            const [attrRes, valRes] = await Promise.all([
                api.get("/inventory/attributes/"),
                api.get("/inventory/attribute-values/")
            ])

            const attrs = attrRes.data.results || attrRes.data
            const vals = valRes.data.results || valRes.data

            return attrs.map((attr: any) => ({
                ...attr,
                values: vals.filter((v: any) => v.attribute === attr.id)
            }))
        },
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            return api.delete(`/inventory/attributes/${id}/`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ATTRIBUTES_QUERY_KEY })
        },
    })

    return {
        attributes,
        refetch,
        deleteAttribute: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending
    }
}
