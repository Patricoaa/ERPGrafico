import { useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import type { PaymentRequest, PaymentRequestStatus } from '../types'

const TERMINAL_STATUSES: ReadonlySet<PaymentRequestStatus> = new Set([
    'COMPLETED',
    'FAILED',
    'CANCELED',
])

const POLL_INTERVAL_MS = 5_000

interface UsePaymentStatusReturn {
    paymentRequest: PaymentRequest | undefined
    isTerminal: boolean
    isLoading: boolean
    error: Error | null
}

export function usePaymentStatus(
    idempotencyKey: string | null,
): UsePaymentStatusReturn {
    const { data, isLoading, error } = useQuery<PaymentRequest, Error>({
        queryKey: ['payment-request', idempotencyKey],
        queryFn: () => treasuryApi.getPaymentRequest(idempotencyKey!),
        enabled: idempotencyKey !== null,
        refetchInterval: (query) => {
            const status = query.state.data?.status
            if (!status || TERMINAL_STATUSES.has(status)) return false
            return POLL_INTERVAL_MS
        },
        refetchIntervalInBackground: false,
    })

    return {
        paymentRequest: data,
        isTerminal: data ? TERMINAL_STATUSES.has(data.status) : false,
        isLoading,
        error,
    }
}
