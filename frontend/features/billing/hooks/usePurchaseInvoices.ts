import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '../api/billingApi'
import { toast } from 'sonner'
import type { InvoiceFilters } from '../types'
import { PURCHASING_KEYS } from '@/features/purchasing/hooks/usePurchasing'

import { PURCHASE_INVOICES_QUERY_KEY } from './queryKeys'

export { PURCHASE_INVOICES_QUERY_KEY }

interface UsePurchaseInvoicesProps {
    filters?: Omit<InvoiceFilters, 'mode'>
}

export function usePurchaseInvoices({ filters }: UsePurchaseInvoicesProps = {}) {
    const queryClient = useQueryClient()

    const { data: invoices, isLoading, refetch } = useQuery({
        queryKey: [...PURCHASE_INVOICES_QUERY_KEY, filters],
        queryFn: () => billingApi.getInvoices({ ...filters, mode: 'purchase' }),
        staleTime: 2 * 60 * 1000, // 2 min — TODO Fase 2: eliminar client-side filter
    })

    const annulMutation = useMutation({
        mutationFn: async ({ id, force }: { id: number, force: boolean }) => {
            return billingApi.annulInvoice(id, { force })
        },
        onSuccess: () => {
            toast.success('Documento anulado correctamente')
            // Purchase invoice annul changes billing list AND the parent purchase order status
            queryClient.invalidateQueries({ queryKey: PURCHASE_INVOICES_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
        },
        onError: (error: Error) => {
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
