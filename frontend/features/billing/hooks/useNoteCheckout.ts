import { useMutation, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '../api/billingApi'
import { INVOICES_QUERY_KEY } from './useInvoices'

export function useNoteCheckout() {
    const queryClient = useQueryClient()

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: INVOICES_QUERY_KEY })
    }

    const checkoutMutation = useMutation({
        mutationFn: async (formData: FormData) => billingApi.noteWorkflowCheckout(formData),
        onSuccess: () => invalidate(),
    })

    const completeMutation = useMutation({
        mutationFn: async (id: number) => billingApi.completeNoteWorkflow(id),
        onSuccess: () => invalidate(),
    })

    return {
        checkout: checkoutMutation.mutateAsync,
        isCheckingOut: checkoutMutation.isPending,
        completeWorkflow: completeMutation.mutateAsync,
        isCompleting: completeMutation.isPending,
    }
}
