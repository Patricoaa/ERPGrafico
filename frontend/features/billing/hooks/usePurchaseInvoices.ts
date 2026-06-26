import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '../api/billingApi'
import { toast } from 'sonner'
import type { Invoice, InvoiceFilters } from '../types'
import { PURCHASING_KEYS } from '@/features/purchasing'
import { useRealtime } from '@/features/realtime'

import { PURCHASE_INVOICES_QUERY_KEY } from './queryKeys'

export { PURCHASE_INVOICES_QUERY_KEY }

interface UsePurchaseInvoicesProps {
    filters?: Omit<InvoiceFilters, 'mode'>
    initialData?: Invoice[]
}

export function usePurchaseInvoices({ filters, initialData }: UsePurchaseInvoicesProps = {}) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const query = useQuery({
        queryKey: [...PURCHASE_INVOICES_QUERY_KEY, filters],
        queryFn: () => billingApi.getInvoices({ ...filters, mode: 'purchase' }),
        staleTime: 2 * 60 * 1000,
        initialData,
        placeholderData: (prev) => prev,
    })

    const invoices = query.data ?? []
    const showSkeleton = query.isLoading && !invoices.length
    const isRefetching = query.isFetching && !showSkeleton
    const refetch = query.refetch

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: PURCHASE_INVOICES_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
    }

    const annulMutation = useMutation({
        mutationFn: async ({ id, force, reason }: { id: number, force: boolean, reason?: string }) => {
            return billingApi.annulInvoice(id, { force, reason })
        },
        onSuccess: () => {
            markLocalMutation()
            toast.success('Documento anulado correctamente')
            invalidate()
        },
        onError: (error: Error) => {
            console.error("Error annulling invoice", error)
        }
    })

    const cancelMutation = useMutation({
        mutationFn: async ({ id, reason }: { id: number, reason?: string }) =>
            billingApi.cancelInvoice(id, reason ?? ''),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Documento cancelado correctamente')
            invalidate()
        },
    })

    const confirmMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: number; payload: FormData | Record<string, unknown> }) =>
            billingApi.confirmInvoice(id, payload),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
        },
    })

    const payMutation = useMutation({
        mutationFn: async (formData: FormData) => billingApi.createPayment(formData),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Operación registrada correctamente')
            invalidate()
        },
    })

    return {
        invoices,
        isLoading: showSkeleton,
        isRefetching,
        refetch,
        annulInvoice: annulMutation.mutateAsync,
        isAnnulling: annulMutation.isPending,
        cancelInvoice: cancelMutation.mutateAsync,
        confirmInvoice: confirmMutation.mutateAsync,
        makePayment: payMutation.mutateAsync,
    }
}
