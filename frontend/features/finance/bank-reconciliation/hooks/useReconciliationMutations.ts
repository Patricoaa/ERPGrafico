import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { reconciliationKeys } from './queryKeys'
import type { ReconciliationRule } from '../types'

export function useMatchMutation(statementId: number, treasuryAccountId: number) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ lineId, paymentId, isBatch, confirmData }: { lineId: number; paymentId: number; isBatch?: boolean; confirmData?: any }) => {
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

            queryClient.setQueryData(linesKey, (old: any) => old?.filter((l: any) => l.id !== lineId))
            queryClient.setQueryData(paymentsKey, (old: any) => old?.filter((p: any) => p.id !== paymentId))

            return { previousLines, previousPayments, linesKey, paymentsKey }
        },
        onError: (err, variables, context: any) => {
            showApiError(err, 'Error al realizar match')
            if (context?.previousLines) {
                queryClient.setQueryData(context.linesKey, context.previousLines)
            }
            if (context?.previousPayments) {
                queryClient.setQueryData(context.paymentsKey, context.previousPayments)
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.unreconciledLines(statementId) })
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.unreconciledPayments(treasuryAccountId) })
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.statement(statementId) })
        }
    })
}

export function useGroupMatchMutation(statementId: number, treasuryAccountId: number) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ payload, confirmPayload, lineId }: { payload: any, confirmPayload: any, lineId: number }) => {
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

            queryClient.setQueryData(linesKey, (old: any) => old?.filter((l: any) => !lineIds.includes(l.id)))
            queryClient.setQueryData(paymentsKey, (old: any) => old?.filter((p: any) => !paymentIds.includes(p.id)))

            return { previousLines, previousPayments, linesKey, paymentsKey }
        },
        onError: (err, variables, context: any) => {
            showApiError(err, 'Error creando grupo')
            if (context?.previousLines) {
                queryClient.setQueryData(context.linesKey, context.previousLines)
            }
            if (context?.previousPayments) {
                queryClient.setQueryData(context.paymentsKey, context.previousPayments)
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.unreconciledLines(statementId) })
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.unreconciledPayments(treasuryAccountId) })
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.statement(statementId) })
        }
    })
}

export function useExcludeMutation(statementId: number) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ lineId, reason, notes }: { lineId: number; reason: string; notes: string }) => {
            return api.patch(`/treasury/statement-lines/${lineId}/`, {
                reconciliation_state: 'EXCLUDED',
                exclusion_reason: reason,
                exclusion_notes: notes
            })
        },
        onMutate: async ({ lineId }) => {
            const linesKey = reconciliationKeys.unreconciledLines(statementId)
            await queryClient.cancelQueries({ queryKey: linesKey })
            const previousLines = queryClient.getQueryData(linesKey)
            queryClient.setQueryData(linesKey, (old: any) => old?.filter((l: any) => l.id !== lineId))
            return { previousLines, linesKey }
        },
        onError: (err, variables, context: any) => {
            showApiError(err, 'Error al excluir')
            if (context?.previousLines) {
                queryClient.setQueryData(context.linesKey, context.previousLines)
            }
        },
        onSuccess: () => {
            toast.success("Movimiento excluido correctamente")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.unreconciledLines(statementId) })
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
        onMutate: async ({ lineIds }) => {
            const linesKey = reconciliationKeys.unreconciledLines(statementId)
            await queryClient.cancelQueries({ queryKey: linesKey })
            const previousLines = queryClient.getQueryData(linesKey)
            queryClient.setQueryData(linesKey, (old: any) => old?.filter((l: any) => !lineIds.includes(l.id)))
            return { previousLines, linesKey }
        },
        onError: (err, variables, context: any) => {
            showApiError(err, 'Error al excluir masivamente')
            if (context?.previousLines) {
                queryClient.setQueryData(context.linesKey, context.previousLines)
            }
        },
        onSuccess: () => {
            toast.success("Movimientos excluidos correctamente")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.unreconciledLines(statementId) })
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
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.unreconciledLines(statementId) })
            // Auto match could have matched payments, we should invalidate across accounts to be safe
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.all }) 
        }
    })
}

export function useSaveRuleMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (rule: Partial<ReconciliationRule>) => {
            const payload = { ...rule, treasury_account: rule.treasury_account?.id || null }
            if (rule.id) {
                await api.patch(`/treasury/reconciliation-rules/${rule.id}/`, payload)
                return { success: true, isNew: false }
            } else {
                await api.post('/treasury/reconciliation-rules/', payload)
                return { success: true, isNew: true }
            }
        },
        onSuccess: (data) => {
            toast.success(data.isNew ? 'Regla creada' : 'Regla actualizada')
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.rules() })
        },
        onError: (err) => {
            showApiError(err, 'Error al guardar regla')
        }
    })
}

export function useCreateDefaultRulesMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (accountId: number) => {
            await api.post('/treasury/reconciliation-rules/create_defaults/', { treasury_account_id: accountId })
        },
        onSuccess: () => {
            toast.success('Reglas predeterminadas creadas')
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.rules() })
        },
        onError: (err) => {
            showApiError(err, 'Error al crear reglas predeterminadas')
        }
    })
}
