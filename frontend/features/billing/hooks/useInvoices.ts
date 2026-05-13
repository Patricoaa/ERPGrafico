import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '../api/billingApi'
import { toast } from 'sonner'
import type { InvoiceFilters } from '../types'

export const INVOICES_QUERY_KEY = ['invoices']

interface UseInvoicesProps {
    filters?: InvoiceFilters
    initialData?: Record<string, unknown> // For server-side prefetching if needed
}

export function useInvoices({ filters }: UseInvoicesProps = {}) {
    const queryClient = useQueryClient()

    const { data: invoices, isLoading, refetch } = useQuery({
        queryKey: [...INVOICES_QUERY_KEY, filters],
        queryFn: () => billingApi.getInvoices(filters),
    })

    const annulMutation = useMutation({
        mutationFn: async ({ id, force }: { id: number, force: boolean }) => {
            return billingApi.annulInvoice(id, { force })
        },
        onSuccess: () => {
            toast.success('Documento anulado correctamente')
            queryClient.invalidateQueries({ queryKey: INVOICES_QUERY_KEY })
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
