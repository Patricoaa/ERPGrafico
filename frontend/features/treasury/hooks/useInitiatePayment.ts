import { useMutation } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import type { InitiatePaymentPayload, PaymentRequest } from '../types'

interface UseInitiatePaymentReturn {
    initiate: (payload: InitiatePaymentPayload) => Promise<PaymentRequest>
    isPending: boolean
    error: Error | null
}

export function useInitiatePayment(): UseInitiatePaymentReturn {
    const mutation = useMutation<PaymentRequest, Error, InitiatePaymentPayload>({
        mutationFn: treasuryApi.initiatePayment,
    })

    return {
        initiate: mutation.mutateAsync,
        isPending: mutation.isPending,
        error: mutation.error,
    }
}
