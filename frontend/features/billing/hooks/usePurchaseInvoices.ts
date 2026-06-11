import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '../api/billingApi'
import { toast } from 'sonner'
import type {InvoiceFilters} from '../types'
import { PURCHASING_KEYS } from '@/features/purchasing'

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
        staleTime: 2 * 60 * 1000,
    })

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: PURCHASE_INVOICES_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
    }

    const annulMutation = useMutation({
        mutationFn: async ({ id, force }: { id: number, force: boolean }) => {
            return billingApi.annulInvoice(id, { force })
        },
        onSuccess: () => {
            toast.success('Documento anulado correctamente')
            invalidate()
        },
        onError: (error: Error) => {
            console.error("Error annulling invoice", error)
        }
    })

    const cancelMutation = useMutation({
        mutationFn: async (id: number) => billingApi.cancelInvoice(id),
        onSuccess: () => {
            toast.success('Documento cancelado correctamente')
            invalidate()
        },
    })

    const confirmMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: number; payload: FormData | Record<string, unknown> }) =>
            billingApi.confirmInvoice(id, payload),
        onSuccess: () => {
            invalidate()
        },
    })

    const payMutation = useMutation({
        mutationFn: async (formData: FormData) => billingApi.createPayment(formData),
        onSuccess: () => {
            toast.success('Operación registrada correctamente')
            invalidate()
        },
    })

    return {
        invoices: invoices ?? [],
        isLoading,
        refetch,
        annulInvoice: annulMutation.mutateAsync,
        isAnnulling: annulMutation.isPending,
        cancelInvoice: cancelMutation.mutateAsync,
        confirmInvoice: confirmMutation.mutateAsync,
        makePayment: payMutation.mutateAsync,
    }
}
