import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '../api/billingApi'
import { toast } from 'sonner'
import type { InvoiceFilters } from '../types'
import { SALES_KEYS } from '@/features/sales/hooks/useSalesOrders'

import { INVOICES_QUERY_KEY } from './queryKeys'

export { INVOICES_QUERY_KEY }

interface UseInvoicesProps {
    filters?: InvoiceFilters
    initialData?: Record<string, unknown> // For server-side prefetching if needed
}

export function useInvoices({ filters }: UseInvoicesProps = {}) {
    const queryClient = useQueryClient()

    const { data: invoices, isLoading, refetch } = useQuery({
        queryKey: [...INVOICES_QUERY_KEY, filters],
        queryFn: () => billingApi.getInvoices(filters),
        staleTime: 2 * 60 * 1000, // 2 min — TODO Fase 2: eliminar client-side filter
    })

    const annulMutation = useMutation({
        mutationFn: async ({ id, force }: { id: number, force: boolean }) => {
            return billingApi.annulInvoice(id, { force })
        },
        onSuccess: () => {
            toast.success('Documento anulado correctamente')
            // Invoice annul changes both billing list AND the parent sale order status
            queryClient.invalidateQueries({ queryKey: INVOICES_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
        },
        onError: (error: Error) => {
            // Let component handle specific errors
            console.error("Error annulling invoice", error)
        }
    })

    return {
        invoices: invoices ?? [],
        isLoading,
        refetch,
        annulInvoice: annulMutation.mutateAsync,
        isAnnulling: annulMutation.isPending
    }
}
