import { useMutation, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '../api/billingApi'
import { INVOICES_QUERY_KEY } from './useInvoices'
import { useRealtime } from '@/features/realtime'

export function useNoteCheckout() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: INVOICES_QUERY_KEY })
    }

    const checkoutMutation = useMutation({
        mutationFn: async (formData: FormData) => billingApi.noteWorkflowCheckout(formData),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
        },
    })

    return {
        checkout: checkoutMutation.mutateAsync,
        isCheckingOut: checkoutMutation.isPending,
    }
}
