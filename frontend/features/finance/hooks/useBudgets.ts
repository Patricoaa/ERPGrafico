import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { financeApi, type Budget } from '../api/financeApi'
import { toast } from 'sonner'
import { FINANCE_KEYS } from './queryKeys'
import { useRealtime } from '@/features/realtime'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { staleTime } from '@/lib/query-config'

export type { Budget }

export function useBudgetDetailData(id: number | null, initialBudget?: Budget | null) {
    const source = initialBudget ? "initial" : "full"
    return useQuery({
        queryKey: [...FINANCE_KEYS.budgets.detailData(id ?? 0), source],
        queryFn: async () => {
            if (initialBudget) {
                // The panel already has the row loaded by `useSelectedEntity`: no second GET.
                const execution = await financeApi.getBudgetExecution(id as number)
                return { budget: initialBudget, execution }
            }
            const [budget, execution] = await Promise.all([
                financeApi.getBudgetDetail(id as number),
                financeApi.getBudgetExecution(id as number)
            ])
            return { budget, execution }
        },
        enabled: id != null,
        staleTime: staleTime.stable,
        placeholderData: (prev) => prev,
    })
}

export function useBudgetVariance(id: number | null, params?: Record<string, unknown>) {
    return useQuery({
        queryKey: FINANCE_KEYS.budgets.variance(id ?? 0, params),
        queryFn: () => financeApi.getBudgetVariance(id as number, params),
        enabled: id != null,
        staleTime: staleTime.standard,
    })
}

/**
 * Todos los presupuestos para selectores: el paginador del API corta a 200 filas por página,
 * así que se recorren las páginas (no se comparte caché con la lista filtrada de budgets/list).
 */
export function useAllBudgets() {
    const { data, isLoading, isError } = useQuery({
        queryKey: [...FINANCE_KEYS.budgets.lists(), { all: true }] as const,
        queryFn: async () => {
            const first = await financeApi.getBudgets({ page: "1", page_size: "200", ordering: "name" })
            const rows = [...first.results]
            let page = 2
            while (first.hasNextPage && rows.length < first.count) {
                const next = await financeApi.getBudgets({ page: String(page), page_size: "200", ordering: "name" })
                if (next.results.length === 0) break
                rows.push(...next.results)
                page += 1
            }
            return rows
        },
        staleTime: staleTime.stable,
    })
    return { budgets: data ?? [], isLoading, isError }
}

export function useBudgets(params: Record<string, string> = {}) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: FINANCE_KEYS.budgets.list(params),
        queryFn: () => financeApi.getBudgets(params),
        staleTime: staleTime.stable,
    })

    const createMutation = useMutation({
        mutationFn: (payload: Partial<Budget>) => financeApi.createBudget(payload),
        onSuccess: () => {
            markLocalMutation()
            invalidateCrossFeature(queryClient, [FINANCE_KEYS.budgets.lists()])
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
            markLocalMutation()
            invalidateCrossFeature(queryClient, [FINANCE_KEYS.budgets.lists()])
            toast.success('Presupuesto actualizado exitosamente')
        },
        onError: (error) => {
            console.error(error)
            toast.error('Error al actualizar presupuesto')
        }
    })

    return {
        page: data,
        budgets: data?.results ?? [],
        isLoading,
        isError,
        refetch,
        createBudget: createMutation.mutateAsync,
        updateBudget: updateMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
    }
}
