import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface Attribute {
    id: number
    name: string
    code: string
    value_type: 'text' | 'number' | 'date' | 'boolean'
    is_required: boolean
    active: boolean
    values?: AttributeValue[]
}

export interface AttributeValue {
    id: number
    attribute: number
    name: string
    code: string
    extra_price: number | string
}

export interface AttributeFilters {
    search?: string
}

export const ATTRIBUTES_QUERY_KEY = ['inventoryAttributes']

export function useAttributes({ filters }: { filters?: AttributeFilters } = {}) {
    const queryClient = useQueryClient()

    const { data: attributes, isLoading, refetch } = useQuery({
        queryKey: [...ATTRIBUTES_QUERY_KEY, filters],
        queryFn: async (): Promise<Attribute[]> => {
            const [attrRes, valRes] = await Promise.all([
                api.get("/inventory/attributes/", { params: filters }),
                api.get("/inventory/attribute-values/")
            ])

            const attrs = attrRes.data.results || attrRes.data
            const vals = valRes.data.results || valRes.data

            return attrs.map((attr: Attribute) => ({
                ...attr,
                values: vals.filter((v: AttributeValue) => v.attribute === attr.id)
            }))
        },
        staleTime: 15 * 60 * 1000, // 15 min — datos de configuración
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
        attributes: attributes ?? [],
        isLoading,
        refetch,
        deleteAttribute: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending
    }
}
