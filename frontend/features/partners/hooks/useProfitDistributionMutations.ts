'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { partnersApi } from '@/features/contacts'
import { LEDGER_QUERY_KEY } from '@/features/accounting'
import { MOVEMENTS_KEYS, TREASURY_ACCOUNTS_KEYS } from '@/features/treasury'
import { useRealtime } from '@/features/realtime'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { PARTNER_KEYS } from './queryKeys'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'

type CreateInput = Parameters<typeof partnersApi.createProfitDistribution>[0]
type LinesInput = Parameters<typeof partnersApi.updateProfitDistributionLines>[1]
type PaymentsInput = { id: number; treasuryAccountId: number; payments: { partner_id: number; amount: number }[]; idempotencyKey: string }

/** Ciclo de vida de una resolución de distribución (borrador → aprobada → ejecutada → pagos). */
export function useProfitDistributionMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const approveKey = useIdempotencyKey()
    const executeKey = useIdempotencyKey()
    const invalidate = () => {
        markLocalMutation()
        invalidateCrossFeature(queryClient, [
            PARTNER_KEYS.all,
            MOVEMENTS_KEYS.all,
            TREASURY_ACCOUNTS_KEYS.all,
            LEDGER_QUERY_KEY,
        ])
    }

    const create = useMutation({
        mutationFn: (data: CreateInput) => partnersApi.createProfitDistribution(data),
        onSuccess: invalidate,
    })
    const update = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => partnersApi.updateProfitDistribution(id, data),
        onSuccess: invalidate,
    })
    const recalculate = useMutation({
        mutationFn: (id: number) => partnersApi.recalculateProfitDistribution(id),
        onSuccess: invalidate,
    })
    const updateLines = useMutation({
        mutationFn: ({ id, lines }: { id: number; lines: LinesInput }) => partnersApi.updateProfitDistributionLines(id, lines),
        onSuccess: invalidate,
    })
    const approve = useMutation({
        mutationFn: (id: number) => partnersApi.approveProfitDistribution(id, approveKey.keyFor(id)),
        onSuccess: () => { approveKey.succeeded(); invalidate() },
        onError: approveKey.failed,
    })
    const execute = useMutation({
        mutationFn: (id: number) => partnersApi.executeProfitDistribution(id, executeKey.keyFor(id)),
        onSuccess: () => { executeKey.succeeded(); invalidate() },
        onError: executeKey.failed,
    })
    const remove = useMutation({
        mutationFn: (id: number) => partnersApi.deleteProfitDistribution(id),
        onSuccess: invalidate,
    })
    const massPayment = useMutation({
        mutationFn: ({ id, treasuryAccountId, payments, idempotencyKey }: PaymentsInput) =>
            partnersApi.massPaymentProfitDistribution(id, treasuryAccountId, payments, idempotencyKey),
        onSuccess: invalidate,
    })

    return { create, update, recalculate, updateLines, approve, execute, remove, massPayment }
}
