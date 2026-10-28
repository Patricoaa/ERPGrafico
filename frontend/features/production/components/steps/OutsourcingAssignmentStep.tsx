"use client"

import type { ReactNode } from 'react'
import { Plus, Truck } from 'lucide-react'
import { ActionConfirmModal, Chip, DataCell, QuantityDisplay, StepHeader } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { formatCurrency } from "@/lib/money"
import { showApiError } from '@/lib/errors'
import { useWorkOrderMutations, productionApi } from '../../hooks'
import { useState } from 'react'
import { useVatRate } from '@/hooks/useVatRate'
import { PlanningEmptyState } from '../shared/PlanningEmptyState'
import { OutsourcedServiceForm, type OutsourcedServiceValues, emptyOutsourcedService } from '../shared/OutsourcedServiceForm'
import type { WorkOrder, WorkOrderMaterial, ProductMinimal } from '../../types'
import { getDomainConceptTitle } from "@/lib/entity-registry"

interface OutsourcingAssignmentStepProps {
  order: WorkOrder
  isViewingCurrentStage: boolean
  onMaterialSaved: () => void
  onMaterialDeleted: () => void
  headerActions?: ReactNode
}

export function OutsourcingAssignmentStep({
  order, isViewingCurrentStage, onMaterialSaved, onMaterialDeleted, headerActions,
}: OutsourcingAssignmentStepProps) {
  const { multiplier: vatMultiplier } = useVatRate()
  const { addMaterial, updateMaterial, removeMaterial, isAddingMaterial } = useWorkOrderMutations(
    order.id,
    { onSuccess: onMaterialSaved }
  )

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<OutsourcedServiceValues>(emptyOutsourcedService())
  const [serviceToDelete, setServiceToDelete] = useState<WorkOrderMaterial | null>(null)

  const reset = () => {
    setIsAddOpen(false)
    setEditingId(null)
    setFormData(emptyOutsourcedService())
  }

  const handleSave = async () => {
    if (!formData.productId || parseFloat(formData.qty) <= 0 || !formData.supplierId || parseFloat(formData.grossPrice) <= 0) return
    try {
      const productId = formData.productId
      if (!productId) return
      if (editingId) {
        await updateMaterial({
          materialId: editingId, quantity: formData.qty, uomId: formData.uomId,
          isOutsourced: true, supplierId: formData.supplierId, unitPrice: formData.netPrice, documentType: formData.documentType,
        })
      } else {
        await addMaterial({
          productId, quantity: formData.qty, uomId: formData.uomId,
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
    productionApi.getProduct(m.component).then((data) => {
      setFormData(prev => ({ ...prev, productObj: data as unknown as ProductMinimal }))
      setIsAddOpen(true)
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

  const openAdd = () => { reset(); setIsAddOpen(true) }
  const isEmpty = outsourced.length === 0

  return (
    <div className="flex flex-1 flex-col gap-4">
      <StepHeader
        title="Asignación de Tercerizados"
        description="Servicios externos contratados para esta orden de producción."
        icon={Truck}
        rightContent={headerActions}
      />
        {isEmpty && !isAddOpen && (
          <PlanningEmptyState
            kind="outsourcing"
            action={isViewingCurrentStage ? (
              <Button variant="outline" size="sm" onClick={openAdd}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar servicio tercerizado
              </Button>
            ) : undefined}
          />
        )}
        {!isEmpty && <div className="grid gap-3">
          {outsourced.map((m: WorkOrderMaterial) => (
            <div key={m.id} className="flex items-center justify-between p-3 border rounded-md bg-card group">
              <div className="flex items-center gap-3">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{m.component_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.supplier_name} · <QuantityDisplay value={m.quantity_planned} uom={m.uom_name} decimals={2} className="font-sans" /> · {formatCurrency(parseFloat(m.unit_price ?? '0') * vatMultiplier)} bruto c/u
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right mr-2">
                  <p className="text-3xs font-bold uppercase text-muted-foreground">Total Estimado</p>
                  <p className="text-sm font-bold text-primary">
                    {formatCurrency(parseFloat(String(m.quantity_planned)) * parseFloat(m.unit_price ?? '0') * vatMultiplier)}
                  </p>
                </div>
                {isViewingCurrentStage && !m.purchase_order_number && (
                  <DataCell.ActionGroup>
                    <DataCell.Action action="edit" onClick={() => handleEdit(m)} />
                    <DataCell.Action action="delete" onClick={() => setServiceToDelete(m)} />
                  </DataCell.ActionGroup>
                )}
                {m.purchase_order_number && <Chip size="xs">OC {m.purchase_order_number}</Chip>}
              </div>
            </div>
          ))}
        </div>}

        {isViewingCurrentStage && (isAddOpen || !isEmpty) && (
          <div>
            {isAddOpen ? (
              <OutsourcedServiceForm
                value={formData}
                onChange={setFormData}
                onSave={handleSave}
                onCancel={reset}
                saving={isAddingMaterial}
                isEditing={!!editingId}
                productLocked={!!editingId}
                showInfo={false}
              />
            ) : (
              <Button
                variant="outline" size="sm"
                className="w-full border-dashed"
                onClick={openAdd}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar Servicio Tercerizado
              </Button>
            )}
          </div>
        )}

      <ActionConfirmModal
        open={serviceToDelete !== null}
        onOpenChange={(open) => { if (!open) setServiceToDelete(null) }}
        onConfirm={async () => {
          if (serviceToDelete) await handleDelete(serviceToDelete.id)
        }}
        title="Eliminar servicio tercerizado"
        description={
          <>
            ¿Eliminar <strong>{serviceToDelete?.component_name}</strong> de la {getDomainConceptTitle('ot').toLowerCase()}?
            Esta acción no se puede deshacer.
          </>
        }
        variant="destructive"
        confirmText="Eliminar"
      />
    </div>
  )
}
