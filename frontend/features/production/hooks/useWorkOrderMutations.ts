import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { showApiError } from '@/lib/errors'
import type { WorkOrderStageData } from '../schemas'

export const WORK_ORDER_QUERY_KEY = 'work-order'
export const WORK_ORDERS_LIST_KEY = 'work-orders'

// ─── Payload types ────────────────────────────────────────────────────────────

export interface TransitionPayload {
  nextStageId: string
  data?: WorkOrderStageData
  /** Optional design file to attach (multipart) */
  designFile?: File | null
}

export interface RectifyPayload {
  materialAdjustments?: { material_id: number; actual_quantity: number }[]
  producedQuantity?: number | string | null
  notes?: string
}

export interface AddMaterialPayload {
  productId: number | string
  quantity: number | string
  uomId: number | string
  isOutsourced?: boolean
  supplierId?: number | string | null
  unitPrice?: number | string
  documentType?: string
}

export interface UpdateMaterialPayload {
  materialId: number
  quantity: number | string
  uomId?: number | string
  isOutsourced?: boolean
  supplierId?: number | string | null
  unitPrice?: number | string
  documentType?: string
}

export interface AddCommentPayload {
  text: string
  authorName: string
  currentStageData: WorkOrderStageData
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * All write operations for a single WorkOrder.
 *
 * Pass `onSuccess` to run a callback (e.g. refetch) after any mutation succeeds.
 * Each mutation also invalidates the list query so the kanban stays fresh.
 */
export function useWorkOrderMutations(
  orderId: number | string,
  { onSuccess }: { onSuccess?: () => void } = {}
) {
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [WORK_ORDER_QUERY_KEY, String(orderId)] })
    queryClient.invalidateQueries({ queryKey: [WORK_ORDERS_LIST_KEY] })
    onSuccess?.()
  }

  // ── transition ─────────────────────────────────────────────────────────────
  const transitionMutation = useMutation({
    mutationFn: async ({ nextStageId, data = {}, designFile }: TransitionPayload) => {
      const formData = new FormData()
      formData.append('next_stage', nextStageId)
      formData.append('data', JSON.stringify(data))
      if (designFile) {
        formData.append('design_attachment', designFile)
      }
      const res = await api.post(
        `/production/orders/${orderId}/transition/`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return res.data
    },
    onSuccess: () => {
      toast.success('Etapa actualizada')
      invalidate()
    },
    onError: (err) => showApiError(err, 'Error al cambiar de etapa'),
  })

  // ── rectify ────────────────────────────────────────────────────────────────
  const rectifyMutation = useMutation({
    mutationFn: async ({ materialAdjustments = [], producedQuantity, notes = '' }: RectifyPayload) => {
      const res = await api.post(`/production/orders/${orderId}/rectify/`, {
        material_adjustments: materialAdjustments,
        produced_quantity: producedQuantity ?? undefined,
        notes,
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Rectificación aplicada')
      invalidate()
    },
    onError: (err) => showApiError(err, 'Error al rectificar la OT'),
  })

  // ── addMaterial ────────────────────────────────────────────────────────────
  const addMaterialMutation = useMutation({
    mutationFn: async ({
      productId, quantity, uomId,
      isOutsourced = false, supplierId = null, unitPrice = 0, documentType = 'FACTURA',
    }: AddMaterialPayload) => {
      const res = await api.post(`/production/orders/${orderId}/add_material/`, {
        product_id: productId,
        quantity,
        uom_id: uomId,
        is_outsourced: isOutsourced,
        supplier_id: supplierId,
        unit_price: unitPrice,
        document_type: documentType,
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Material agregado')
      invalidate()
    },
    onError: (err) => showApiError(err, 'Error al agregar material'),
  })

  // ── updateMaterial ─────────────────────────────────────────────────────────
  const updateMaterialMutation = useMutation({
    mutationFn: async ({
      materialId, quantity, uomId,
      isOutsourced, supplierId, unitPrice, documentType,
    }: UpdateMaterialPayload) => {
      const res = await api.post(`/production/orders/${orderId}/update_material/`, {
        material_id: materialId,
        quantity,
        uom_id: uomId,
        is_outsourced: isOutsourced,
        supplier_id: supplierId,
        unit_price: unitPrice,
        document_type: documentType,
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Material actualizado')
      invalidate()
    },
    onError: (err) => showApiError(err, 'Error al actualizar material'),
  })

  // ── removeMaterial ─────────────────────────────────────────────────────────
  const removeMaterialMutation = useMutation({
    mutationFn: async (materialId: number) => {
      const res = await api.post(`/production/orders/${orderId}/remove_material/`, {
        material_id: materialId,
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Material eliminado')
      invalidate()
    },
    onError: (err) => showApiError(err, 'Error al eliminar material'),
  })

  // ── annul ──────────────────────────────────────────────────────────────────
  const annulMutation = useMutation({
    mutationFn: async (notes: string = '') => {
      const res = await api.post(`/production/orders/${orderId}/annul/`, { notes })
      return res.data
    },
    onSuccess: () => {
      toast.success('Orden de Trabajo anulada exitosamente')
      invalidate()
    },
    onError: (err) => showApiError(err, 'Error al anular la orden'),
  })

  // ── deleteOrder ────────────────────────────────────────────────────────────
  const deleteOrderMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/production/orders/${orderId}/`)
    },
    onSuccess: () => {
      toast.success('Orden de Trabajo eliminada')
      invalidate()
    },
    onError: (err) => showApiError(err, 'Error al eliminar la orden'),
  })

  // ── addComment ─────────────────────────────────────────────────────────────
  const addCommentMutation = useMutation({
    mutationFn: async ({ text, authorName, currentStageData }: AddCommentPayload) => {
      const newComment = {
        id: crypto.randomUUID(),
        user: authorName,
        text,
        timestamp: new Date().toISOString(),
      }
      const updatedStageData: WorkOrderStageData = {
        ...currentStageData,
        comments: [...(currentStageData.comments ?? []), newComment],
      }
      const res = await api.patch(`/production/orders/${orderId}/`, {
        stage_data: updatedStageData,
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Comentario registrado')
      invalidate()
    },
    onError: () => toast.error('Error al registrar comentario'),
  })

  return {
    // mutations
    transition: transitionMutation.mutateAsync,
    rectify: rectifyMutation.mutateAsync,
    addMaterial: addMaterialMutation.mutateAsync,
    updateMaterial: updateMaterialMutation.mutateAsync,
    removeMaterial: removeMaterialMutation.mutateAsync,
    annul: annulMutation.mutateAsync,
    deleteOrder: deleteOrderMutation.mutateAsync,
    addComment: addCommentMutation.mutateAsync,

    // loading states (parallel to the wizard's existing boolean flags)
    isTransitioning: transitionMutation.isPending,
    isRectifying: rectifyMutation.isPending,
    isAddingMaterial: addMaterialMutation.isPending || updateMaterialMutation.isPending,
    isAnnuling: annulMutation.isPending,
    isDeleting: deleteOrderMutation.isPending,
  }
}
