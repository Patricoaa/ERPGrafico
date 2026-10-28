"use client"

import { useState } from 'react'
import { Plus, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActionConfirmModal, Chip, DataCell } from '@/components/shared'
import { productionApi } from '../../hooks'
import { MaterialAssignmentTabs } from '../MaterialAssignmentTabs'
import { PLANNING_EMPTY_COPY, PlanningEmptyState } from '../shared/PlanningEmptyState'
import { MaterialLineForm, emptyMaterialLine, type MaterialLineValues } from '../shared/MaterialLineForm'
import { useVatRate } from '@/hooks/useVatRate'
import { useWorkOrderMutations } from '../../hooks'
import { Collection, useEntityCollection } from '@/components/entity-view'
import { workOrderMaterialEntity, workOrderMaterialViews } from '../../entity-view/workOrderMaterial.entity'

import { showApiError } from '@/lib/errors'
import type { WorkOrder, WorkOrderMaterial, ProductMinimal } from '../../types'
import { getDomainConceptTitle } from "@/lib/entity-registry"

interface MaterialAssignmentStepProps {
  order: WorkOrder
  isViewingCurrentStage: boolean
  onMaterialSaved: () => void
  onMaterialDeleted: () => void
}

export function MaterialAssignmentStep({
  order, isViewingCurrentStage, onMaterialSaved, onMaterialDeleted,
}: MaterialAssignmentStepProps) {
  const { multiplier: vatMultiplier } = useVatRate()
  const { addMaterial, updateMaterial, removeMaterial, isAddingMaterial } = useWorkOrderMutations(
    order.id,
    { onSuccess: onMaterialSaved }
  )

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingMaterialId, setEditingMaterialId] = useState<number | null>(null)
  const [materialToDelete, setMaterialToDelete] = useState<WorkOrderMaterial | null>(null)

  const [line, setLine] = useState<MaterialLineValues>(emptyMaterialLine())

  const reset = () => {
    setIsAddOpen(false)
    setEditingMaterialId(null)
    setLine(emptyMaterialLine())
  }

  const handleSave = async () => {
    if (!line.productId) return
    if (parseFloat(line.qty) <= 0) return
    try {
      if (editingMaterialId) {
        await updateMaterial({ materialId: editingMaterialId, quantity: line.qty, uomId: line.uomId })
      } else {
        await addMaterial({ productId: line.productId, quantity: line.qty, uomId: line.uomId })
      }
      reset()
    } catch (err) {
      showApiError(err, 'Error al guardar material')
    }
  }

  const handleEdit = (m: WorkOrderMaterial) => {
    setEditingMaterialId(m.id)
    setLine({ productId: m.component.toString(), productObj: null, qty: m.quantity_planned.toString(), uomId: m.uom.toString() })
    productionApi.getProduct(m.component).then((data) => {
      setLine(prev => ({ ...prev, productObj: data as unknown as ProductMinimal }))
      setIsAddOpen(true)
    })
  }

  const handleDelete = async (materialId: number) => {
    try {
      await removeMaterial(materialId)
      onMaterialDeleted()
    } catch (err) {
      showApiError(err, 'Error al eliminar material')
    }
  }

  const stockMaterials = order.materials?.filter((m: WorkOrderMaterial) => !m.is_outsourced) ?? []
  const outsourcedMaterials = order.materials?.filter((m: WorkOrderMaterial) => m.is_outsourced) ?? []

  const stockCollection = useEntityCollection(
    workOrderMaterialEntity,
    { rows: stockMaterials },
    { pagination: { mode: "none" } }
  )

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <MaterialAssignmentTabs
          stockCount={stockMaterials.length}
          outsourcedCount={outsourcedMaterials.length}
          showOutsourcedTab={false}
          stockContent={
            <div className="space-y-6">
              <div className="border rounded-md overflow-x-auto">
                <Collection.Root
                  collection={stockCollection}
                  label="Materiales de stock"
                  actions={(row) => {
                    if (row.source !== 'MANUAL' || !isViewingCurrentStage) return null
                    return (
                      <DataCell.ActionGroup>
                        <DataCell.Action action="edit" onClick={() => handleEdit(row)} />
                        <DataCell.Action action="delete" onClick={() => setMaterialToDelete(row)} />
                      </DataCell.ActionGroup>
                    )
                  }}
                >
                  <Collection.View
                    table={workOrderMaterialViews.table}
                    emptyTitle={PLANNING_EMPTY_COPY.materials.title}
                    emptyDescription={PLANNING_EMPTY_COPY.materials.description}
                  />
                </Collection.Root>
              </div>

              {isViewingCurrentStage && (
                <>
                  {isAddOpen ? (
                    <MaterialLineForm
                      value={line}
                      onChange={setLine}
                      onSave={handleSave}
                      onCancel={reset}
                      saving={isAddingMaterial}
                      isEditing={!!editingMaterialId}
                      excludeProductId={order.main_product_id}
                    />
                  ) : (
                    <div className="flex flex-col gap-3">
                      <Button
                        variant="outline" size="sm" className="w-full border-dashed"
                        onClick={() => { reset(); setIsAddOpen(true) }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar Material de Stock
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          }
          outsourcedContent={
            <div className="space-y-6">
              <div className="grid gap-3">
                {outsourcedMaterials.map((m: WorkOrderMaterial) => (
                  <div key={m.id} className="flex items-center justify-between p-3 border rounded-md bg-background group">
                    <div className="flex items-center gap-3">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold">{m.component_name}</p>
                        <div className="flex items-center gap-2 text-3xs text-muted-foreground uppercase font-bold">
                          <span>{m.supplier_name}</span>
                          <span>•</span>
                          <span>Cant: {m.quantity_planned} {m.uom_name}</span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1">
                            <DataCell.Currency value={parseFloat(m.unit_price ?? '0') * vatMultiplier} weight="bold" className="w-auto justify-start text-3xs text-muted-foreground p-0 inline-flex" />
                            <span>(Bruto) c/u</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right mr-2 flex flex-col items-end">
                        <p className="text-3xs font-bold uppercase text-muted-foreground">Total Estimado</p>
                        <DataCell.Currency
                          value={parseFloat(String(m.quantity_planned)) * parseFloat(m.unit_price ?? '0') * vatMultiplier}
                          className="justify-end text-sm text-primary w-auto p-0 inline-flex"
                          weight="bold"
                        />
                      </div>
                      {isViewingCurrentStage && !m.purchase_order_number && (
                        <DataCell.ActionGroup>
                          <DataCell.Action action="edit" onClick={() => handleEdit(m)} />
                          <DataCell.Action action="delete" onClick={() => setMaterialToDelete(m)} />
                        </DataCell.ActionGroup>
                      )}
                      {m.purchase_order_number && (
                        <div className="flex items-center gap-2">
                          <Chip size="xs">OCS-{m.purchase_order_number}</Chip>
                          <span className="text-3xs font-medium text-muted-foreground">({m.supplier_name})</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {outsourcedMaterials.length === 0 && <PlanningEmptyState kind="outsourcing" />}
              </div>
            </div>
          }
        />
      </div>

      <ActionConfirmModal
        open={materialToDelete !== null}
        onOpenChange={(open) => { if (!open) setMaterialToDelete(null) }}
        onConfirm={async () => {
          if (materialToDelete) await handleDelete(materialToDelete.id)
        }}
        title="Eliminar material"
        description={
          <>
            ¿Eliminar <strong>{materialToDelete?.component_name}</strong> de la {getDomainConceptTitle('ot').toLowerCase()}?
            Esta acción no se puede deshacer.
          </>
        }
        variant="destructive"
        confirmText="Eliminar"
      />
    </div>
  )
}
