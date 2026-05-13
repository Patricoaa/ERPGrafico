import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'
import { Invoice } from '@/features/billing/types'
import type { FilterState } from '@/components/shared'

import { PURCHASING_KEYS } from './queryKeys'

export { PURCHASING_KEYS }

export function usePurchasingOrders(filters?: FilterState) {
    const queryClient = useQueryClient()

    const { data: orders, isLoading, refetch } = useQuery({
        queryKey: [...PURCHASING_KEYS.orders(), filters],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (filters?.status) params.append('status', filters.status)
            if (filters?.search) params.append('search', filters.search)
            if (filters?.date_from) params.append('date_after', filters.date_from)
            if (filters?.date_to) params.append('date_before', filters.date_to)
            const res = await api.get('/purchasing/orders/', { params })
            return res.data.results || res.data
        },
        staleTime: 2 * 60 * 1000,
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
