import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface UoMCategory {
    id: number
    name: string
}

export interface UoM {
    id: number
    name: string
    category: number
    category_name: string
    uom_type: 'REFERENCE' | 'BIGGER' | 'SMALLER'
    ratio: string
    rounding: string
    active: boolean
}

export const UOMS_QUERY_KEY = ['uoms']
export const UOM_CATEGORIES_QUERY_KEY = ['uomCategories']

export function useUoMs() {
    const queryClient = useQueryClient()

    const { data: uoms, isLoading: isUoMsLoading, refetch } = useQuery({
        queryKey: UOMS_QUERY_KEY,
        queryFn: async (): Promise<UoM[]> => {
            const response = await api.get('/inventory/uoms/')
            return response.data.results || response.data
        },
    })

    const { data: categories, isLoading: isCategoriesLoading } = useQuery({
        queryKey: UOM_CATEGORIES_QUERY_KEY,
        queryFn: async (): Promise<UoMCategory[]> => {
            const response = await api.get('/inventory/uom-categories/')
            return response.data.results || response.data
        },
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            return api.delete(`/inventory/uoms/${id}/`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: UOMS_QUERY_KEY })
        },
    })

    const saveMutation = useMutation({
        mutationFn: async (uom: Partial<UoM>) => {
            if (uom.id) {
                return api.put(`/inventory/uoms/${uom.id}/`, uom)
            } else {
                return api.post('/inventory/uoms/', uom)
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: UOMS_QUERY_KEY })
        },
    })

    return {
        uoms: uoms ?? [],
        categories: categories ?? [],
        isLoading: isUoMsLoading || isCategoriesLoading,
        refetch,
        deleteUoM: deleteMutation.mutateAsync,
        saveUoM: saveMutation.mutateAsync,
        isSaving: saveMutation.isPending
    }
}
