import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { treasuryApi } from '../api/treasuryApi'
import { MONTHLY_INVOICES_KEYS } from './queryKeys'
import { useRealtime } from '@/features/realtime'

export function useMonthlyInvoice() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const generateInvoice = useMutation({
        mutationFn: (formData: FormData) => treasuryApi.generateInvoice(formData),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Factura generada exitosamente')
            invalidateCrossFeature(queryClient, [MONTHLY_INVOICES_KEYS.all])
        },
        onError: (err) => {
            showApiError(err, 'Error al generar factura')
        },
    })

    return {
        generateInvoice: generateInvoice.mutateAsync,
        isGenerating: generateInvoice.isPending,
    }
}
