import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '../api/billingApi'
import { toast } from 'sonner'
import { useRealtime } from '@/features/realtime'
import type { InvoiceFilters, Invoice } from '../types'
import { SALES_KEYS } from '@/features/sales/hooks/useSalesOrders'

import { INVOICES_QUERY_KEY } from './queryKeys'

export { INVOICES_QUERY_KEY }

interface UseInvoicesProps {
    filters?: InvoiceFilters
    initialData?: Invoice[]
}

export function useInvoices({ filters, initialData }: UseInvoicesProps = {}) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const query = useQuery({
        queryKey: [...INVOICES_QUERY_KEY, filters],
        queryFn: () => billingApi.getInvoices(filters),
        staleTime: 2 * 60 * 1000, // 2 min — TODO Fase 2: eliminar client-side filter
        initialData,
        placeholderData: (prev) => prev,
    })

    const invoices = query.data ?? []
    const showSkeleton = query.isLoading && !invoices.length
    const isRefetching = query.isFetching && !showSkeleton
    const refetch = query.refetch

    const invalidateBilling = () => {
        queryClient.invalidateQueries({ queryKey: INVOICES_QUERY_KEY })
        // Invoice mutations afectan también el estado de la orden de venta padre.
        queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
    }

    const annulMutation = useMutation({
        mutationFn: async ({ id, force, reason }: { id: number, force: boolean, reason?: string }) => {
            return billingApi.annulInvoice(id, { force, reason })
        },
        onSuccess: () => {
            markLocalMutation()
            toast.success('Documento anulado correctamente')
            invalidateBilling()
        },
        onError: (error: Error) => {
            // Let component handle specific errors
            console.error("Error annulling invoice", error)
        }
    })

    const confirmMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: number, payload: FormData | Record<string, unknown> }) =>
            billingApi.confirmInvoice(id, payload),
        onSuccess: () => {
            markLocalMutation()
            invalidateBilling()
        },
    })

    const registerNoteMutation = useMutation({
        mutationFn: async ({ invoiceId, payload }: { invoiceId: number, payload: FormData }) =>
            billingApi.registerNoteOnInvoice(invoiceId, payload),
        onSuccess: () => {
            markLocalMutation()
            invalidateBilling()
        },
    })

    const posCheckoutMutation = useMutation({
        mutationFn: async (payload: FormData) => billingApi.posCheckout(payload),
        onSuccess: () => {
            markLocalMutation()
            invalidateBilling()
        },
    })

    const requestCreditMutation = useMutation({
        mutationFn: async (payload: FormData) => billingApi.requestCredit(payload),
        onSuccess: () => {
            markLocalMutation()
            invalidateBilling()
        },
    })

    return {
        invoices,
        isLoading: showSkeleton,
        isRefetching,
        refetch,
        annulInvoice: annulMutation.mutateAsync,
        isAnnulling: annulMutation.isPending,
        confirmInvoice: confirmMutation.mutateAsync,
        isConfirming: confirmMutation.isPending,
        registerNoteOnInvoice: registerNoteMutation.mutateAsync,
        posCheckout: posCheckoutMutation.mutateAsync,
        isCheckingOut: posCheckoutMutation.isPending,
        requestCredit: requestCreditMutation.mutateAsync,
        isRequestingCredit: requestCreditMutation.isPending,
    }
}

/**
 * Fetch a single invoice by id. queryKey alineada con INVOICES_QUERY_KEY +
 * id para que invalidaciones masivas refresquen también el detalle.
 */
export function useInvoice(id: number | null | undefined) {
    return useQuery({
        queryKey: id ? [...INVOICES_QUERY_KEY, 'detail', id] : [...INVOICES_QUERY_KEY, 'detail', 'noop'],
        queryFn: () => billingApi.getInvoice(id as number),
        enabled: !!id,
    })
}
