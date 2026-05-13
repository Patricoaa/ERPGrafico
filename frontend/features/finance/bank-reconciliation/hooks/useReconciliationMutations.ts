import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { reconciliationKeys } from './queryKeys'
import type { ReconciliationRule } from '../types'

export function useMatchMutation(statementId: number, treasuryAccountId: number) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ lineId, paymentId, isBatch, confirmData }: { lineId: number; paymentId: number; isBatch?: boolean; confirmData?: Record<string, unknown> }) => {
            if (isBatch) {
                await api.post(`/treasury/statement-lines/match_group/`, {
                    line_ids: [lineId],
                    batch_ids: [paymentId],
                    payment_ids: []
                })
            } else {
                await api.post(`/treasury/statement-lines/${lineId}/match/`, { payment_id: paymentId })
            }
            if (confirmData) {
                await api.post(`/treasury/statement-lines/${lineId}/confirm/`, confirmData)
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
            await api.post('/treasury/statement-lines/match_group/', payload)
            if (confirmPayload && Object.keys(confirmPayload).length > 0) {
                await api.post(`/treasury/statement-lines/${lineId}/confirm/`, confirmPayload)
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
            return api.patch(`/treasury/statement-lines/${lineId}/`, {
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
            return api.post(`/treasury/statement-lines/bulk_exclude/`, {
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
            return api.patch(`/treasury/statement-lines/${lineId}/`, {
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
            const res = await api.post(`/treasury/statements/${statementId}/auto_match/`, { confidence_threshold: confidenceThreshold })
            return res.data
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
            const res = await api.patch(`/treasury/reconciliation-settings/${settings.id}/`, settings)
            return res.data
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
            // 1. Crear el movimiento
            const movementRes = await api.post('/treasury/movements/', movementData)
            const paymentId = movementRes.data.id

            // 2. Realizar el match con la línea
            await api.post(`/treasury/statement-lines/${lineId}/match/`, { payment_id: paymentId })
            
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
            return api.post(`/treasury/statement-lines/${lineId}/unmatch/`)
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
            return api.post(`/treasury/movements/${movementId}/allocate/?validate_sum=${validateSum}`, { allocations })
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
            return api.post('/treasury/movements/', movementData)
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
