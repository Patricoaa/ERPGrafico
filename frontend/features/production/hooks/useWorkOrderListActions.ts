/**
 * useWorkOrderListActions — TASK-107
 *
 * Lightweight mutations for list-level actions (delete, annul, transition)
 * where the orderId is only known at call time, not at hook instantiation.
 *
 * This avoids calling useWorkOrderMutations(id) conditionally (which violates
 * the Rules of Hooks). Each mutationFn receives the id as part of the payload.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { showApiError } from '@/lib/errors'
import { WORK_ORDERS_LIST_KEY, WORK_ORDER_QUERY_KEY } from './useWorkOrderMutations'

interface DeletePayload { id: number | string }
interface AnnulPayload  { id: number | string; notes?: string }
interface TransitionListPayload { id: number | string; nextStage: string }
interface BulkTransitionPayload { ids: number[]; nextStage: string }
interface BulkPrintPayload { ids: number[] }

/**
 * Mutations scoped to the list page (no single orderId at hook level).
 * Pass an optional `onSuccess` callback to refresh the list after each action.
 */
export function useWorkOrderListActions(
  { onSuccess }: { onSuccess?: () => void } = {}
) {
  const queryClient = useQueryClient()

  const invalidate = (id?: number | string) => {
    if (id) {
      queryClient.invalidateQueries({ queryKey: [WORK_ORDER_QUERY_KEY, String(id)] })
    }
    queryClient.invalidateQueries({ queryKey: [WORK_ORDERS_LIST_KEY] })
    onSuccess?.()
  }

  // ── delete ─────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async ({ id }: DeletePayload) => {
      await api.delete(`/production/orders/${id}/`)
    },
    onSuccess: (_, { id }) => {
      toast.success('OT eliminada correctamente.')
      invalidate(id)
    },
    onError: (err) => showApiError(err, 'Error al eliminar la OT'),
  })

  // ── annul ──────────────────────────────────────────────────────────────────
  const annulMutation = useMutation({
    mutationFn: async ({ id, notes = '' }: AnnulPayload) => {
      const res = await api.post(`/production/orders/${id}/annul/`, { notes })
      return res.data
    },
    onSuccess: (_, { id }) => {
      toast.success('OT anulada correctamente.')
      invalidate(id)
    },
    onError: (err) => showApiError(err, 'Error al anular la OT'),
  })

  // ── duplicate ──────────────────────────────────────────────────────────────
  const duplicateMutation = useMutation({
    mutationFn: async ({ id }: { id: number | string }) => {
      const res = await api.post(`/production/orders/${id}/duplicate/`)
      return res.data
    },
    onSuccess: () => {
      toast.success('OT duplicada correctamente.')
      queryClient.invalidateQueries({ queryKey: [WORK_ORDERS_LIST_KEY] })
      onSuccess?.()
    },
    onError: (err) => showApiError(err, 'Error al duplicar la OT'),
  })

  // ── transition (list-level, e.g. kanban drag or quick action) ──────────────
  const transitionMutation = useMutation({
    mutationFn: async ({ id, nextStage }: TransitionListPayload) => {
      const res = await api.post(`/production/orders/${id}/transition/`, {
        next_stage: nextStage,
      })
      return res.data
    },
    onSuccess: (_, { id }) => {
      toast.success('Etapa actualizada.')
      invalidate(id)
    },
    onError: (err) => showApiError(err, 'Error al cambiar etapa'),
  })

  // ── bulk transition ────────────────────────────────────────────────────────
  const bulkTransitionMutation = useMutation({
    mutationFn: async ({ ids, nextStage }: BulkTransitionPayload) => {
      const res = await api.post('/production/orders/bulk_transition/', {
        ids,
        next_stage: nextStage,
      })
      return res.data as { ok: number[]; errors: { id: number; error: string }[] }
    },
    onSuccess: (data) => {
      const errCount = data.errors?.length ?? 0
      if (errCount > 0) {
        toast.warning(`${data.ok.length} OTs avanzadas, ${errCount} con error.`)
      } else {
        toast.success(`${data.ok.length} OTs avanzadas correctamente.`)
      }
      invalidate()
    },
    onError: (err) => showApiError(err, 'Error al cambiar etapas'),
  })

  // ── bulk print ─────────────────────────────────────────────────────────────
  const bulkPrintMutation = useMutation({
    mutationFn: async ({ ids }: BulkPrintPayload) => {
      const res = await api.post(
        '/production/orders/bulk_print/',
        { ids },
        { responseType: 'blob' },
      )
      const url = URL.createObjectURL(new Blob([res.data as BlobPart], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `OTs-${ids.join('-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    },
    onSuccess: () => toast.success('PDF generado correctamente.'),
    onError: (err) => showApiError(err, 'Error al generar PDF'),
  })

  return {
    deleteOrder:  deleteMutation.mutateAsync,
    annulOrder:   annulMutation.mutateAsync,
    transition:   transitionMutation.mutateAsync,
    duplicateOrder: duplicateMutation.mutateAsync,
    bulkTransition: bulkTransitionMutation.mutateAsync,
    bulkPrint:    bulkPrintMutation.mutateAsync,
    isDeleting:   deleteMutation.isPending,
    isAnnuling:   annulMutation.isPending,
    isTransitioning: transitionMutation.isPending,
    isDuplicating: duplicateMutation.isPending,
    isBulkTransitioning: bulkTransitionMutation.isPending,
    isBulkPrinting: bulkPrintMutation.isPending,
  }
}
