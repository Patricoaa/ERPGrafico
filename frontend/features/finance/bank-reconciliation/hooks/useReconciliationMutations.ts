import { useMutation, useQueryClient } from '@tanstack/react-query'
import { financeApi } from '../../api/financeApi'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { reconciliationKeys } from './queryKeys'

export function useMatchMutation(statementId: number, treasuryAccountId: number) {
    const queryClient = useQueryClient()

    return useMutation({
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
            queryClient.invalidateQueries({ queryKey: [...reconciliationKeys.all, 'unreconciled-lines', statementId] })
            queryClient.invalidateQueries({ queryKey: [...reconciliationKeys.all, 'unreconciled-payments', treasuryAccountId] })
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.statement(statementId) })
        }
    })
}

export function useGroupMatchMutation(statementId: number, treasuryAccountId: number) {
    const queryClient = useQueryClient()

    return useMutation({
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
            queryClient.invalidateQueries({ queryKey: [...reconciliationKeys.all, 'unreconciled-lines', statementId] })
            queryClient.invalidateQueries({ queryKey: [...reconciliationKeys.all, 'unreconciled-payments', treasuryAccountId] })
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.statement(statementId) })
        }
    })
}

export function useExcludeMutation(statementId: number) {
    const queryClient = useQueryClient()

    return useMutation({
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
            toast.success("Movimiento excluido correctamente")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: [...reconciliationKeys.all, 'unreconciled-lines', statementId] })
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.statement(statementId) })
        }
    })
}

export function useBulkExcludeMutation(statementId: number) {
    const queryClient = useQueryClient()

    return useMutation({
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
            toast.success("Movimientos excluidos correctamente")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: [...reconciliationKeys.all, 'unreconciled-lines', statementId] })
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.statement(statementId) })
        }
    })
}

export function useRestoreMutation(statementId: number) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (lineId: number) => {
            return financeApi.updateStatementLine(lineId, {
                reconciliation_status: 'UNRECONCILED',
                exclusion_reason: null,
                exclusion_notes: null
            })
        },
        onSuccess: () => {
            toast.success("Movimiento restaurado")
        },
        onError: (err) => {
            showApiError(err, 'Error al restaurar')
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: [...reconciliationKeys.all, 'unreconciled-lines', statementId] })
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.statement(statementId) })
        }
    })
}

export function useAutoMatchMutation(statementId: number) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ confidenceThreshold }: { confidenceThreshold: number }) => {
            return financeApi.autoMatch(statementId, { confidence_threshold: confidenceThreshold })
        },
        onSuccess: (data) => {
            toast.success(`Conciliación Finalizada`, {
                description: `${data.matched_count} de ${data.total_unreconciled} líneas conciliadas automáticamente.`
            })
        },
        onError: (err) => {
            showApiError(err, 'Error en auto-match')
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: [...reconciliationKeys.all, 'unreconciled-lines', statementId] })
            // Auto match could have matched payments across accounts — invalidate all unreconciled-payments
            // but scoped to reconciliation domain, not everything
            queryClient.invalidateQueries({ queryKey: [...reconciliationKeys.all, 'unreconciled-payments'] })
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.statement(statementId) })
        }
    })
}

export function useUpdateReconciliationSettingsMutation(accountId?: number | string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (settings: Record<string, unknown> & { id: number }) => {
            const { id, ...rest } = settings
            return financeApi.updateReconciliationSettings(id, rest)
        },
        onSuccess: () => {
            toast.success('Configuración de inteligencia actualizada')
            if (accountId) {
                queryClient.invalidateQueries({ queryKey: reconciliationKeys.settings(accountId) })
            } else {
                queryClient.invalidateQueries({ queryKey: reconciliationKeys.all })
            }
        },
        onError: (err) => {
            showApiError(err, 'Error al guardar configuración')
        }
    })
}

/**
 * Encadena la creación de un movimiento de tesorería y su match automático con una línea
 */
export function useCreateAndMatchMutation(statementId: number, treasuryAccountId: number) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ lineId, movementData }: { lineId: number, movementData: Record<string, unknown> }) => {
            const movement = await financeApi.createMovement(movementData)
            const paymentId = (movement as any).id
            await financeApi.matchStatementLine(lineId, { payment_id: paymentId })
            return { lineId, paymentId }
        },
        onSuccess: () => {
            toast.success("Pago registrado y conciliado correctamente")
        },
        onError: (err) => {
            showApiError(err, "Error al crear y conciliar pago")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: [...reconciliationKeys.all, 'unreconciled-lines', statementId] })
            queryClient.invalidateQueries({ queryKey: [...reconciliationKeys.all, 'unreconciled-payments', treasuryAccountId] })
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.statement(statementId) })
        }
    })
}

/**
 * Revierte una conciliación (match) para permitir el 'Undo'
 */
export function useUnmatchMutation(statementId: number, treasuryAccountId: number) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (lineId: number) => {
            return financeApi.unmatchLine(lineId)
        },
        onSuccess: () => {
            toast.success("Conciliación revertida")
        },
        onError: (err) => {
            showApiError(err, "Error al deshacer conciliación")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: [...reconciliationKeys.all, 'unreconciled-lines', statementId] })
            queryClient.invalidateQueries({ queryKey: [...reconciliationKeys.all, 'unreconciled-payments', treasuryAccountId] })
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.statement(statementId) })
        }
    })
}

/**
 * S5.2: Create or update partial allocations for a treasury movement
 */
export function useAllocateMutation(movementId: number, treasuryAccountId?: number) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ allocations, validateSum = false }: { allocations: Record<string, unknown>[], validateSum?: boolean }) => {
            return financeApi.allocateMovement(movementId, { allocations, validate_sum: validateSum })
        },
        onSuccess: () => {
            toast.success("Distribución guardada correctamente")
        },
        onError: (err) => {
            showApiError(err, "Error al guardar la distribución")
        },
        onSettled: () => {
            if (treasuryAccountId) {
                queryClient.invalidateQueries({ queryKey: reconciliationKeys.unreconciledPayments(treasuryAccountId) })
            }
            // Invalidate other generic movement/payment queries if necessary
        }
    })
}

/**
 * Crea un movimiento de tesorería sin realizar match inmediato
 */
export function useCreateMovementMutation(treasuryAccountId: number) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (movementData: Record<string, unknown>) => {
            return financeApi.createMovement(movementData)
        },
        onSuccess: () => {
            toast.success("Movimiento creado correctamente")
        },
        onError: (err) => {
            showApiError(err, "Error al crear movimiento")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: [...reconciliationKeys.all, 'unreconciled-payments', treasuryAccountId] })
        }
    })
}
