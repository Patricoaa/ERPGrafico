import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { financeApi } from '../api/financeApi'
import { toast } from 'sonner'
import { FINANCE_KEYS } from './queryKeys'

export interface Budget {
    id: number
    name: string
    start_date: string
    end_date: string
    description?: string
}

export function useBudgetDetailData(id: number | null) {
    return useQuery({
        queryKey: FINANCE_KEYS.budgets.detailData(id ?? 0),
        queryFn: async () => {
            const [budget, execution] = await Promise.all([
                financeApi.getBudgetDetail(id as number),
                financeApi.getBudgetExecution(id as number)
            ])
            return { budget, execution }
        },
        enabled: id != null,
        staleTime: 5 * 60 * 1000,
    })
}

export function useBudgetVariance(id: number | null, params?: Record<string, unknown>) {
    return useQuery({
        queryKey: FINANCE_KEYS.budgets.variance(id ?? 0),
        queryFn: () => financeApi.getBudgetVariance(id as number, params),
        enabled: id != null,
        staleTime: 2 * 60 * 1000,
    })
}

export function useBudgets() {
    const queryClient = useQueryClient()

    const { data: budgets, isLoading, refetch } = useQuery({
        queryKey: FINANCE_KEYS.budgets.lists(),
        queryFn: financeApi.getBudgets,
        staleTime: 5 * 60 * 1000,
    })

    const createMutation = useMutation({
        mutationFn: (payload: Partial<Budget>) => financeApi.createBudget(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: FINANCE_KEYS.budgets.lists() })
            toast.success('Presupuesto creado exitosamente')
        },
        onError: (error) => {
            console.error(error)
            toast.error('Error al crear presupuesto')
        }
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number, payload: Partial<Budget> }) =>
            financeApi.updateBudget(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: FINANCE_KEYS.budgets.lists() })
            toast.success('Presupuesto actualizado exitosamente')
        },
        onError: (error) => {
            console.error(error)
            toast.error('Error al actualizar presupuesto')
        }
    })

    return {
        budgets: budgets ?? [],
        isLoading,
        refetch,
        createBudget: createMutation.mutateAsync,
        updateBudget: updateMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
    }
}
