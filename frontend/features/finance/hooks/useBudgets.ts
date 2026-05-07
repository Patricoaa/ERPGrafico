import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'

export const BUDGETS_QUERY_KEY = ['budgets']

export interface Budget {
    id: number
    name: string
    start_date: string
    end_date: string
    description?: string
}

export function useBudgets() {
    const queryClient = useQueryClient()

    const { data: budgets, refetch } = useSuspenseQuery({
        queryKey: BUDGETS_QUERY_KEY,
        queryFn: async () => {
            const response = await api.get('/accounting/budgets/')
            return response.data
        },
    })

    const createMutation = useMutation({
        mutationFn: (payload: Partial<Budget>) => api.post('/accounting/budgets/', payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: BUDGETS_QUERY_KEY })
            toast.success('Presupuesto creado exitosamente')
        },
        onError: (error) => {
            console.error(error)
            toast.error('Error al crear presupuesto')
        }
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number, payload: Partial<Budget> }) => 
            api.patch(`/accounting/budgets/${id}/`, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: BUDGETS_QUERY_KEY })
            toast.success('Presupuesto actualizado exitosamente')
        },
        onError: (error) => {
            console.error(error)
            toast.error('Error al actualizar presupuesto')
        }
    })

    return {
        budgets,
        refetch,
        createBudget: createMutation.mutateAsync,
        updateBudget: updateMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
    }
}
