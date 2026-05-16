"use client"

import { Plus, Truck, Pencil, Trash2, Info } from 'lucide-react'
import { Chip } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrency } from '@/lib/currency'
import { showApiError } from '@/lib/errors'
import { useHubPanel } from '@/components/providers/HubPanelProvider'
import { useWorkOrderMutations } from '../../hooks'
import { useState } from 'react'
import { useVatRate } from '@/hooks/useVatRate'
import { OutsourcedServiceForm, OutsourcedServiceValues, emptyOutsourcedService } from '../shared/OutsourcedServiceForm'
import type { WorkOrder, WorkOrderMaterial, UoM } from '../../types'

interface OutsourcingAssignmentStepProps {
  order: WorkOrder
  isViewingCurrentStage: boolean
  onMaterialSaved: () => void
  onMaterialDeleted: () => void
}

export function OutsourcingAssignmentStep({
  order, isViewingCurrentStage, onMaterialSaved, onMaterialDeleted,
}: OutsourcingAssignmentStepProps) {
  const { openHub } = useHubPanel()
  const { multiplier: vatMultiplier } = useVatRate()
  const { addMaterial, updateMaterial, removeMaterial, isAddingMaterial } = useWorkOrderMutations(
    order.id,
    { onSuccess: onMaterialSaved }
  )

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<OutsourcedServiceValues>(emptyOutsourcedService())
  const [uoms] = useState<UoM[]>([])

  const reset = () => {
    setIsAddOpen(false)
    setEditingId(null)
    setFormData(emptyOutsourcedService())
  }

  const handleSave = async () => {
    if (!formData.productId || parseFloat(formData.qty) <= 0 || !formData.supplierId || parseFloat(formData.grossPrice) <= 0) return
    try {
      if (editingId) {
        await updateMaterial({
          materialId: editingId, quantity: formData.qty, uomId: formData.uomId,
          isOutsourced: true, supplierId: formData.supplierId, unitPrice: formData.netPrice, documentType: formData.documentType,
        })
      } else {
        await addMaterial({
          productId: formData.productId!, quantity: formData.qty, uomId: formData.uomId,
          isOutsourced: true, supplierId: formData.supplierId, unitPrice: formData.netPrice, documentType: formData.documentType,
        })
      }
      reset()
    } catch (err) {
      showApiError(err, 'Error al guardar servicio')
    }
  }

  const handleEdit = (m: WorkOrderMaterial) => {
    setEditingId(m.id)
    setFormData({
      productId: m.component.toString(),
      productObj: null,
      qty: m.quantity_planned.toString(),
      uomId: m.uom.toString(),
      supplierId: m.supplier?.toString() ?? null,
      netPrice: m.unit_price?.toString() ?? '0',
      grossPrice: m.unit_price ? (parseFloat(m.unit_price) * vatMultiplier).toFixed(2) : '0',
      documentType: (m.document_type as 'FACTURA' | 'BOLETA') ?? 'FACTURA'
    })
    import('@/lib/api').then(({ default: api }) => {
      api.get(`/inventory/products/${m.component}/`).then((res) => {
        setFormData(prev => ({ ...prev, productObj: res.data }))
        setIsAddOpen(true)
      })
    })
  }

  const handleDelete = async (materialId: number) => {
    try {
      await removeMaterial(materialId)
      onMaterialDeleted()
    } catch (err) {
      showApiError(err, 'Error al eliminar servicio')
    }
  }

  const outsourced = order.materials?.filter((m: WorkOrderMaterial) => m.is_outsourced) ?? []

  return (
    <div className="space-y-6">
      <div className="p-4 bg-primary/10 border border-info/10 rounded-md flex gap-3">
        <Plus className="h-5 w-5 text-primary shrink-0" />
        <div className="text-sm text-primary">
          <div className="flex items-center gap-2">
            <p className="font-bold">Asignación de Servicios Tercerizados</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-info/50 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs bg-info text-white border-info">
                  <p className="text-xs">
                    Los servicios tercerizados generarán automáticamente Órdenes de Compra en estado Confirmado que deberán procesarse desde el Hub de la OC.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs">
            Si el trabajo requiere servicios externos de un proveedor, agréguelos aquí. Se generará una Orden de Compra automáticamente.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-3">
          {outsourced.map((m: WorkOrderMaterial) => (
            <div key={m.id} className="flex items-center justify-between p-3 border rounded-md bg-background group">
              <div className="flex items-center gap-3">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <div className="space-y-0.5">
                  <p className="text-sm font-bold">{m.component_name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold">
                    <span>{m.supplier_name}</span>
                    <span>•</span>
                    <span>Cant: {m.quantity_planned} {m.uom_name}</span>
                    <span>•</span>
                    <span>{formatCurrency(parseFloat(m.unit_price ?? '0') * vatMultiplier)} (Bruto) c/u</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right mr-2">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Estimado</p>
                  <p className="text-sm font-bold text-primary">
                    {formatCurrency(parseFloat(String(m.quantity_planned)) * parseFloat(m.unit_price ?? '0') * vatMultiplier)}
                  </p>
                </div>
                {isViewingCurrentStage && !m.purchase_order_number && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(m)} className="h-8 w-8">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Chip size="xs">OCS-{m.purchase_order_number}</Chip>
                  <span className="text-[10px] font-medium text-muted-foreground">({m.supplier_name})</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {isViewingCurrentStage && (
          <div className="pt-2">
            {isAddOpen ? (
              <OutsourcedServiceForm
                value={formData}
                onChange={setFormData}
                onSave={handleSave}
                onCancel={reset}
                saving={isAddingMaterial}
                isEditing={!!editingId}
                uoms={uoms}
                productLocked={!!editingId}
                showInfo={false}
              />
            ) : (
              <Button
                variant="outline" size="sm"
                className="w-full border-dashed text-primary border-primary/20 bg-primary/5 hover:bg-primary/10"
                onClick={() => { reset(); setIsAddOpen(true) }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar Servicio Tercerizado
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
