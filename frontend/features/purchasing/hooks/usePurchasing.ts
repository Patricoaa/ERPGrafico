import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { FilterState } from '@/components/shared'

import { purchasingApi } from '../api/purchasingApi'
import { PURCHASING_KEYS } from './queryKeys'

export { PURCHASING_KEYS }

export function usePurchasingOrders(filters?: FilterState) {
    const queryClient = useQueryClient()

    const { data: orders, isLoading, refetch } = useQuery({
        queryKey: [...PURCHASING_KEYS.orders(), filters],
        queryFn: () => purchasingApi.getOrders(filters),
        staleTime: 2 * 60 * 1000,
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => purchasingApi.deleteOrder(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.lists() })
            toast.success('Orden de Compra eliminada')
        },
    })

    return {
        orders: orders ?? [],
        isLoading,
        refetch,
        deleteOrder: deleteMutation.mutateAsync,
    }
}

export function usePurchasingNotes() {
    const { data: notes, isLoading, refetch } = useQuery({
        queryKey: PURCHASING_KEYS.notes(),
        queryFn: () => purchasingApi.getNotes(),
    })

    return { notes: notes ?? [], isLoading, refetch }
}

export function usePurchasingOrder(id: number) {
    const { data: order, isLoading } = useQuery({
        queryKey: PURCHASING_KEYS.detail(id),
        queryFn: () => purchasingApi.getOrder(id),
    })

    return { order, isLoading }
}
