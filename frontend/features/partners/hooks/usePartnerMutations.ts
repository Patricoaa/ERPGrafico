'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { partnersApi, type PartnerTransactionPayload } from '@/features/contacts'
import { LEDGER_QUERY_KEY } from '@/features/accounting'
import { MOVEMENTS_KEYS, TREASURY_ACCOUNTS_KEYS } from '@/features/treasury'
import { useRealtime } from '@/features/realtime'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { PARTNER_KEYS } from './queryKeys'
import { useIdempotencyKey } from './useIdempotencyKey'

type SubscriptionInput = Parameters<typeof partnersApi.recordSubscription>[0]
type TransferInput = Parameters<typeof partnersApi.recordTransfer>[0]
type DividendInput = Parameters<typeof partnersApi.recordDividendPayment>[1]
type MobilizeInput = Parameters<typeof partnersApi.massMobilizeRetainedEarnings>[0]

/**
 * Mutaciones de socios (capital, aportes, retiros, dividendos). Todas invalidan
 * el árbol `partners` más las vistas de tesorería y mayor que el asiento toca.
 * Los llamadores conservan el `try/catch` y el toast: usan `mutateAsync`.
 */
export function usePartnerMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const { keyFor, succeeded, failed } = useIdempotencyKey()
    const invalidate = () => {
        markLocalMutation()
        invalidateCrossFeature(queryClient, [
            PARTNER_KEYS.all,
            MOVEMENTS_KEYS.all,
            TREASURY_ACCOUNTS_KEYS.all,
            LEDGER_QUERY_KEY,
        ])
    }

    const recordSubscription = useMutation({
        mutationFn: (data: SubscriptionInput) => partnersApi.recordSubscription(data, keyFor(data)),
        onSuccess: () => { succeeded(); invalidate() },
        onError: failed,
    })
    const recordTransfer = useMutation({
        mutationFn: (data: TransferInput) => partnersApi.recordTransfer(data, keyFor(data)),
        onSuccess: () => { succeeded(); invalidate() },
        onError: failed,
    })
    const createTransaction = useMutation({
        mutationFn: ({ contactId, data }: { contactId: number; data: PartnerTransactionPayload }) =>
            partnersApi.createTransaction(contactId, data, keyFor({ contactId, data })),
        onSuccess: () => { succeeded(); invalidate() },
        onError: failed,
    })
    const recordDividendPayment = useMutation({
        mutationFn: ({ contactId, data }: { contactId: number; data: DividendInput }) =>
            partnersApi.recordDividendPayment(contactId, data, keyFor({ contactId, data })),
        onSuccess: () => { succeeded(); invalidate() },
        onError: failed,
    })
    const mobilizeRetainedEarnings = useMutation({
        mutationFn: (data: MobilizeInput) => partnersApi.massMobilizeRetainedEarnings(data, keyFor(data)),
        onSuccess: () => { succeeded(); invalidate() },
        onError: failed,
    })

    const demotePartner = useMutation({
        mutationFn: (contactId: number) => partnersApi.demotePartner(contactId),
        onSuccess: invalidate,
    })

    return { demotePartner, recordSubscription, recordTransfer, createTransaction, recordDividendPayment, mobilizeRetainedEarnings }
}
