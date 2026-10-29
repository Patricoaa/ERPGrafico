"use client"

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Package, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActionConfirmModal, DataCell, StepHeader } from '@/components/shared'
import { productionApi } from '../../hooks'
import { PLANNING_EMPTY_COPY } from '../shared/PlanningEmptyState'
import { MaterialLineForm, emptyMaterialLine, type MaterialLineValues } from '../shared/MaterialLineForm'
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
  headerActions?: ReactNode
}

export function MaterialAssignmentStep({
  order, isViewingCurrentStage, onMaterialSaved, onMaterialDeleted, headerActions,
}: MaterialAssignmentStepProps) {
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

  const stockCollection = useEntityCollection(
    workOrderMaterialEntity,
    { rows: stockMaterials },
    { pagination: { mode: "none" } }
  )

  const isEmpty = stockMaterials.length === 0
  const openAdd = () => { reset(); setIsAddOpen(true) }
  const addButton = (
    <Button variant="outline" size="sm" onClick={openAdd}>
      <Plus className="mr-2 h-4 w-4" />
      Agregar material de stock
    </Button>
  )
  const form = (
    <MaterialLineForm
      value={line}
      onChange={setLine}
      onSave={handleSave}
      onCancel={reset}
      saving={isAddingMaterial}
      isEditing={!!editingMaterialId}
      excludeProductId={order.main_product_id}
    />
  )

  return (
    <div className="flex flex-1 flex-col gap-4">
      <StepHeader
        title="Asignación de Materiales"
        description="Define los materiales de stock que se consumirán en esta producción."
        icon={Package}
        rightContent={headerActions}
      />
      {isEmpty && isAddOpen && isViewingCurrentStage ? form : (
        <div className="flex flex-1 flex-col overflow-x-auto">
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
              emptyAction={isViewingCurrentStage ? addButton : undefined}
            />
          </Collection.Root>
        </div>
      )}

      {/* With rows, adding happens below the table; an empty table offers it inside its frame. */}
      {!isEmpty && isViewingCurrentStage && (
        isAddOpen ? form : (
          <Button variant="outline" size="sm" className="w-full border-dashed" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar material de stock
          </Button>
        )
      )}

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
