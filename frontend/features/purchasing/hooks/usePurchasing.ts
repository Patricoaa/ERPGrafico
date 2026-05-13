import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'
import { Invoice } from '@/features/billing/types'

import { PURCHASING_KEYS } from './queryKeys'

export { PURCHASING_KEYS }

export function usePurchasingOrders() {
    const queryClient = useQueryClient()

    const { data: orders, isLoading, refetch } = useQuery({
        queryKey: PURCHASING_KEYS.orders(),
        queryFn: async () => {
            const res = await api.get('/purchasing/orders/')
            return res.data.results || res.data
        },
        staleTime: 2 * 60 * 1000, // 2 min
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/purchasing/orders/${id}/`),
        onSuccess: () => {
            // Narrow: only orders list is stale on delete, not notes
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.orders() })
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
        queryFn: async () => {
            const response = await api.get('/billing/invoices/', {
                params: {
                    dte_type__in: 'NOTA_CREDITO,NOTA_DEBITO',
                    purchase_order__isnull: false
                }
            })
            return (response.data.results || response.data) as Invoice[]
        },
    })

    return { notes: notes ?? [], isLoading, refetch }
}
