import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'

export const PURCHASING_KEYS = {
    all: ['purchasing'] as const,
    orders: () => [...PURCHASING_KEYS.all, 'orders'] as const,
    notes: () => [...PURCHASING_KEYS.all, 'notes'] as const,
}

export function usePurchasingOrders() {
    const queryClient = useQueryClient()

    const { data: orders, refetch } = useSuspenseQuery({
        queryKey: PURCHASING_KEYS.orders(),
        queryFn: async () => {
            const res = await api.get('/purchasing/orders/')
            return res.data.results || res.data
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/purchasing/orders/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
            toast.success('Orden de Compra eliminada')
        },
    })

    return {
        orders,
        refetch,
        deleteOrder: deleteMutation.mutateAsync,
    }
}

export function usePurchasingNotes() {
    const { data: notes, refetch } = useSuspenseQuery({
        queryKey: PURCHASING_KEYS.notes(),
        queryFn: async () => {
            const response = await api.get('/billing/invoices/', {
                params: {
                    dte_type__in: 'NOTA_CREDITO,NOTA_DEBITO',
                    purchase_order__isnull: false
                }
            })
            const results = response.data.results || response.data
            return results.filter((inv: any) =>
                ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type || '') && inv.purchase_order
            )
        },
    })

    return { notes, refetch }
}
