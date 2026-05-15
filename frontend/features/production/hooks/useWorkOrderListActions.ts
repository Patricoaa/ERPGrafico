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

  return {
    deleteOrder:  deleteMutation.mutateAsync,
    annulOrder:   annulMutation.mutateAsync,
    transition:   transitionMutation.mutateAsync,
    isDeleting:   deleteMutation.isPending,
    isAnnuling:   annulMutation.isPending,
    isTransitioning: transitionMutation.isPending,
  }
}
