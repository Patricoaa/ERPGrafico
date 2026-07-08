import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { financeApi } from '../../api/financeApi'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { reconciliationKeys } from './queryKeys'
import { useRealtime } from '@/features/realtime'

export function useMatchMutation(statementId: number, treasuryAccountId: number) {
    const queryClient = useQueryClient()

    const matchMutation = useMutation({
        mutationFn: async ({ lineId, paymentId, isBatch, confirmData }: { lineId: number; paymentId: number; isBatch?: boolean; confirmData?: Record<string, unknown> }) => {
            if (isBatch) {
                await financeApi.groupMatchLines({
                    line_ids: [lineId],
                    batch_ids: [paymentId],
                    payment_ids: []
                })
            } else {
                await financeApi.matchStatementLine(lineId, { payment_id: paymentId })
            }
            if (confirmData) {
                await financeApi.confirmMatch(lineId, confirmData)
            }
            return { lineId, paymentId, isBatch }
        },
        onMutate: async ({ lineId, paymentId }) => {
            const linesKey = reconciliationKeys.unreconciledLines(statementId)
            const paymentsKey = reconciliationKeys.unreconciledPayments(treasuryAccountId)

            await queryClient.cancelQueries({ queryKey: linesKey })
            await queryClient.cancelQueries({ queryKey: paymentsKey })

            const previousLines = queryClient.getQueryData(linesKey)
            const previousPayments = queryClient.getQueryData(paymentsKey)

            queryClient.setQueryData(linesKey, (old: unknown) => (old as {id: number}[] | undefined)?.filter(l => l.id !== lineId))
            queryClient.setQueryData(paymentsKey, (old: unknown) => (old as {id: number}[] | undefined)?.filter(p => p.id !== paymentId))

            return { previousLines, previousPayments, linesKey, paymentsKey }
        },
        onError: (err: Error, variables, context: unknown) => {
            showApiError(err, 'Error al realizar match')
            const ctx = context as { previousLines?: unknown; previousPayments?: unknown; linesKey: readonly unknown[]; paymentsKey: readonly unknown[] } | undefined
            if (ctx?.previousLines) {
                queryClient.setQueryData(ctx.linesKey, ctx.previousLines)
            }
            if (ctx?.previousPayments) {
                queryClient.setQueryData(ctx.paymentsKey, ctx.previousPayments)
            }
        },
        onSettled: () => {
            invalidateCrossFeature(queryClient, [
                [...reconciliationKeys.all, 'unreconciled-lines', statementId],
                [...reconciliationKeys.all, 'unreconciled-payments', treasuryAccountId],
                reconciliationKeys.statement(statementId),
            ])
        }
    })
    return { match: matchMutation.mutateAsync, isMatching: matchMutation.isPending }
}

export function useGroupMatchMutation(statementId: number, treasuryAccountId: number) {
    const queryClient = useQueryClient()

    const groupMatchMutation = useMutation({
        mutationFn: async ({ payload, confirmPayload, lineId }: { payload: { line_ids?: number[], payment_ids?: number[], batch_ids?: number[] }, confirmPayload?: Record<string, unknown>, lineId: number }) => {
            await financeApi.groupMatchLines(payload)
            if (confirmPayload && Object.keys(confirmPayload).length > 0) {
                await financeApi.confirmMatch(lineId, confirmPayload)
            }
            return payload
        },
        onMutate: async ({ payload }) => {
            const linesKey = reconciliationKeys.unreconciledLines(statementId)
            const paymentsKey = reconciliationKeys.unreconciledPayments(treasuryAccountId)

            await queryClient.cancelQueries({ queryKey: linesKey })
            await queryClient.cancelQueries({ queryKey: paymentsKey })

            const previousLines = queryClient.getQueryData(linesKey)
            const previousPayments = queryClient.getQueryData(paymentsKey)

            const lineIds = payload.line_ids || []
            const paymentIds = [...(payload.payment_ids || []), ...(payload.batch_ids || [])]

            queryClient.setQueryData(linesKey, (old: unknown) => (old as {id: number}[] | undefined)?.filter(l => !lineIds.includes(l.id)))
            queryClient.setQueryData(paymentsKey, (old: unknown) => (old as {id: number}[] | undefined)?.filter(p => !paymentIds.includes(p.id)))

            return { previousLines, previousPayments, linesKey, paymentsKey }
        },
        onError: (err: Error, variables, context: unknown) => {
            showApiError(err, 'Error creando grupo')
            const ctx = context as { previousLines?: unknown; previousPayments?: unknown; linesKey: readonly unknown[]; paymentsKey: readonly unknown[] } | undefined
            if (ctx?.previousLines) {
                queryClient.setQueryData(ctx.linesKey, ctx.previousLines)
            }
            if (ctx?.previousPayments) {
                queryClient.setQueryData(ctx.paymentsKey, ctx.previousPayments)
            }
        },
        onSettled: () => {
            invalidateCrossFeature(queryClient, [
                [...reconciliationKeys.all, 'unreconciled-lines', statementId],
                [...reconciliationKeys.all, 'unreconciled-payments', treasuryAccountId],
                reconciliationKeys.statement(statementId),
            ])
        }
    })
    return { groupMatch: groupMatchMutation.mutateAsync, isGroupMatching: groupMatchMutation.isPending }
}

export function useExcludeMutation(statementId: number) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const excludeMutation = useMutation({
        mutationFn: async ({ lineId, reason, notes }: { lineId: number; reason: string; notes: string }) => {
            return financeApi.updateStatementLine(lineId, {
                reconciliation_status: 'EXCLUDED',
                exclusion_reason: reason,
                exclusion_notes: notes
            })
        },
        onError: (err) => {
            showApiError(err, 'Error al excluir')
        },
        onSuccess: () => {
            markLocalMutation()
            toast.success("Movimiento excluido correctamente")
        },
        onSettled: () => {
            invalidateCrossFeature(queryClient, [
                [...reconciliationKeys.all, 'unreconciled-lines', statementId],
                reconciliationKeys.statement(statementId),
            ])
        }
    })
    return { exclude: excludeMutation.mutateAsync, isExcluding: excludeMutation.isPending }
}

export function useBulkExcludeMutation(statementId: number) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const bulkExcludeMutation = useMutation({
        mutationFn: async ({ lineIds, reason, notes }: { lineIds: number[]; reason: string; notes: string }) => {
            return financeApi.bulkExcludeLines({
                line_ids: lineIds,
                exclusion_reason: reason,
                exclusion_notes: notes
            })
        },
        onError: (err) => {
            showApiError(err, 'Error al excluir masivamente')
        },
        onSuccess: () => {
            markLocalMutation()
            toast.success("Movimientos excluidos correctamente")
        },
        onSettled: () => {
            invalidateCrossFeature(queryClient, [
                [...reconciliationKeys.all, 'unreconciled-lines', statementId],
                reconciliationKeys.statement(statementId),
            ])
        }
    })
    return { bulkExclude: bulkExcludeMutation.mutateAsync, isBulkExcluding: bulkExcludeMutation.isPending }
}

export function useRestoreMutation(statementId: number) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const restoreMutation = useMutation({
        mutationFn: async (lineId: number) => {
            return financeApi.updateStatementLine(lineId, {
                reconciliation_status: 'UNRECONCILED',
                exclusion_reason: null,
                exclusion_notes: null
            })
        },
        onSuccess: () => {
            markLocalMutation()
            toast.success("Movimiento restaurado")
        },
        onError: (err) => {
            showApiError(err, 'Error al restaurar')
        },
        onSettled: () => {
            invalidateCrossFeature(queryClient, [
                [...reconciliationKeys.all, 'unreconciled-lines', statementId],
                reconciliationKeys.statement(statementId),
            ])
        }
    })
    return { restore: restoreMutation.mutateAsync, isRestoring: restoreMutation.isPending }
}

export function useAutoMatchMutation(statementId: number) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const autoMatchMutation = useMutation({
        mutationFn: async ({ confidenceThreshold }: { confidenceThreshold: number }) => {
            return financeApi.autoMatch(statementId, { confidence_threshold: confidenceThreshold })
        },
        onSuccess: (data) => {
            markLocalMutation()
            const res = data as { matched_count?: number; total_unreconciled?: number }
            toast.success(`Conciliación Finalizada`, {
                description: `${res.matched_count ?? 0} de ${res.total_unreconciled ?? 0} líneas conciliadas automáticamente.`
            })
        },
        onError: (err) => {
            showApiError(err, 'Error en auto-match')
        },
        onSettled: () => {
            // Auto match could have matched payments across accounts — scoped to reconciliation domain
            invalidateCrossFeature(queryClient, [
                [...reconciliationKeys.all, 'unreconciled-lines', statementId],
                [...reconciliationKeys.all, 'unreconciled-payments'],
                reconciliationKeys.statement(statementId),
            ])
        }
    })
    return { autoMatch: autoMatchMutation.mutateAsync, isAutoMatching: autoMatchMutation.isPending }
}

export function useUpdateReconciliationSettingsMutation(accountId?: number | string) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const updateSettingsMutation = useMutation({
        mutationFn: async (settings: Record<string, unknown> & { id: number }) => {
            const { id, ...rest } = settings
            return financeApi.updateReconciliationSettings(id, rest)
        },
        onSuccess: () => {
            markLocalMutation()
            toast.success('Configuración de inteligencia actualizada')
            if (accountId) {
                invalidateCrossFeature(queryClient, [reconciliationKeys.settings(Number(accountId))])
            } else {
                invalidateCrossFeature(queryClient, [reconciliationKeys.all])
            }
        },
        onError: (err) => {
            showApiError(err, 'Error al guardar configuración')
        }
    })
    return { updateSettings: updateSettingsMutation.mutateAsync, isUpdatingSettings: updateSettingsMutation.isPending }
}

/**
 * Encadena la creación de un movimiento de tesorería y su match automático con una línea
 */
export function useCreateAndMatchMutation(statementId: number, treasuryAccountId: number) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const createAndMatchMutation = useMutation({
        mutationFn: async ({ lineId, movementData }: { lineId: number, movementData: Record<string, unknown> }) => {
            const movement = await financeApi.createMovement(movementData) as Record<string, unknown>
            const paymentId = movement.id as number
            await financeApi.matchStatementLine(lineId, { payment_id: paymentId })
            return { lineId, paymentId }
        },
        onSuccess: () => {
            markLocalMutation()
            toast.success("Pago registrado y conciliado correctamente")
        },
        onError: (err) => {
            showApiError(err, "Error al crear y conciliar pago")
        },
        onSettled: () => {
            invalidateCrossFeature(queryClient, [
                [...reconciliationKeys.all, 'unreconciled-lines', statementId],
                [...reconciliationKeys.all, 'unreconciled-payments', treasuryAccountId],
                reconciliationKeys.statement(statementId),
            ])
        }
    })
    return { createAndMatch: createAndMatchMutation.mutateAsync, isCreatingAndMatching: createAndMatchMutation.isPending }
}

/**
 * Revierte una conciliación (match) para permitir el 'Undo'
 */
export function useUnmatchMutation(statementId: number, treasuryAccountId: number) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const unmatchMutation = useMutation({
        mutationFn: async (lineId: number) => {
            return financeApi.unmatchLine(lineId)
        },
        onSuccess: () => {
            markLocalMutation()
            toast.success("Conciliación revertida")
        },
        onError: (err) => {
            showApiError(err, "Error al deshacer conciliación")
        },
        onSettled: () => {
            invalidateCrossFeature(queryClient, [
                [...reconciliationKeys.all, 'unreconciled-lines', statementId],
                [...reconciliationKeys.all, 'unreconciled-payments', treasuryAccountId],
                reconciliationKeys.statement(statementId),
            ])
        }
    })
    return { unmatch: unmatchMutation.mutateAsync, isUnmatching: unmatchMutation.isPending }
}

/**
 * S5.2: Create or update partial allocations for a treasury movement
 */
export function useAllocateMutation(movementId: number, treasuryAccountId?: number) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const allocateMutation = useMutation({
        mutationFn: async ({ allocations, validateSum = false }: { allocations: Record<string, unknown>[], validateSum?: boolean }) => {
            return financeApi.allocateMovement(movementId, { allocations, validate_sum: validateSum })
        },
        onSuccess: () => {
            markLocalMutation()
            toast.success("Distribución guardada correctamente")
        },
        onError: (err) => {
            showApiError(err, "Error al guardar la distribución")
        },
        onSettled: () => {
            if (treasuryAccountId) {
                invalidateCrossFeature(queryClient, [reconciliationKeys.unreconciledPayments(treasuryAccountId)])
            }
            // Invalidate other generic movement/payment queries if necessary
        }
    })
    return { allocate: allocateMutation.mutateAsync, isAllocating: allocateMutation.isPending }
}

/**
 * Crea un movimiento de tesorería sin realizar match inmediato
 */
export function useCreateMovementMutation(treasuryAccountId: number) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const createMovementMutation = useMutation({
        mutationFn: async (movementData: Record<string, unknown>) => {
            return financeApi.createMovement(movementData)
        },
        onSuccess: () => {
            markLocalMutation()
            toast.success("Movimiento creado correctamente")
        },
        onError: (err) => {
            showApiError(err, "Error al crear movimiento")
        },
        onSettled: () => {
            invalidateCrossFeature(queryClient, [[...reconciliationKeys.all, 'unreconciled-payments', treasuryAccountId]])
        }
    })
    return { createMovement: createMovementMutation.mutateAsync, isCreatingMovement: createMovementMutation.isPending }
}
