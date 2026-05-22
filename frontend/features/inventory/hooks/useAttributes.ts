import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useRealtime } from '@/features/realtime'

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
    const { markLocalMutation } = useRealtime()

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

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ATTRIBUTES_QUERY_KEY })

    const saveAttributeMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: number | null, payload: Partial<Attribute> }) => {
            const res = id !== null
                ? await api.patch(`/inventory/attributes/${id}/`, payload)
                : await api.post('/inventory/attributes/', payload)
            return res.data as Attribute
        },
        onSuccess: (_, vars) => {
            markLocalMutation()
            toast.success(vars.id === null ? 'Atributo creado' : 'Atributo actualizado')
            invalidate()
        },
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => api.delete(`/inventory/attributes/${id}/`),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
        },
    })

    const createValueMutation = useMutation({
        mutationFn: async ({ attribute, value }: { attribute: number, value: string }) => {
            const res = await api.post('/inventory/attribute-values/', { attribute, value })
            return res.data as AttributeValue & { value: string }
        },
        onSuccess: () => {
            markLocalMutation()
            // Invalidación amplia: el join de attributes + values se recompone
            // de cero porque useAttributes une los dos endpoints en su queryFn.
            invalidate()
        },
    })

    const deleteValueMutation = useMutation({
        mutationFn: async (id: number) => api.delete(`/inventory/attribute-values/${id}/`),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
        },
    })

    return {
        attributes: attributes ?? [],
        isLoading,
        refetch,
        saveAttribute: saveAttributeMutation.mutateAsync,
        isSaving: saveAttributeMutation.isPending,
        deleteAttribute: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,
        createAttributeValue: createValueMutation.mutateAsync,
        isCreatingValue: createValueMutation.isPending,
        deleteAttributeValue: deleteValueMutation.mutateAsync,
        isDeletingValue: deleteValueMutation.isPending,
    }
}
