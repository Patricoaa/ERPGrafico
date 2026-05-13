import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '../api/billingApi'
import { toast } from 'sonner'
import type { InvoiceFilters } from '../types'

export const PURCHASE_INVOICES_QUERY_KEY = ['purchase-invoices']

interface UsePurchaseInvoicesProps {
    filters?: Omit<InvoiceFilters, 'mode'>
}

export function usePurchaseInvoices({ filters }: UsePurchaseInvoicesProps = {}) {
    const queryClient = useQueryClient()

    const { data: invoices, isLoading, refetch } = useQuery({
        queryKey: [...PURCHASE_INVOICES_QUERY_KEY, filters],
        queryFn: () => billingApi.getInvoices({ ...filters, mode: 'purchase' }),
    })

    const annulMutation = useMutation({
        mutationFn: async ({ id, force }: { id: number, force: boolean }) => {
            return billingApi.annulInvoice(id, { force })
        },
        onSuccess: () => {
            toast.success('Documento anulado correctamente')
            queryClient.invalidateQueries({ queryKey: PURCHASE_INVOICES_QUERY_KEY })
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
