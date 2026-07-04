"use client"

import { useMemo, useState } from 'react'
import { Plus, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ActionConfirmModal, Chip, DataCell, DataTable } from '@/components/shared'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/shared'
import { ProductSelector } from '@/components/selectors/ProductSelector'
import { UoMSelector } from '@/components/selectors/UoMSelector'
import { useProductionVariants, productionApi } from '../../hooks'
import { MaterialAssignmentTabs } from '../MaterialAssignmentTabs'
import { useVatRate } from '@/hooks/useVatRate'
import { useWorkOrderMutations } from '../../hooks'
import type { ColumnDef } from '@tanstack/react-table'

import { cn } from '@/lib/utils'
import { showApiError } from '@/lib/errors'
import type { WorkOrder, WorkOrderMaterial, ProductMinimal } from '../../types'


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

  // ── form state (local — not shared) ─────────────────────────────────────
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingMaterialId, setEditingMaterialId] = useState<number | null>(null)
  const [materialToDelete, setMaterialToDelete] = useState<WorkOrderMaterial | null>(null)

  const [productId, setProductId] = useState<string | null>(null)
  const [qty, setQty] = useState('1')
  const [uomId, setUomId] = useState<string>('')
  const [productObj, setProductObj] = useState<ProductMinimal | null>(null)
  const { variants, isVariantsLoading: loadingVariants } = useProductionVariants(
    productObj?.has_variants ? productObj.id : undefined
  )

  const reset = () => {
    setIsAddOpen(false)
    setEditingMaterialId(null)
    setProductId(null)
    setQty('1')
    setUomId('')
    setProductObj(null)
  }

  const handleSave = async () => {
    if (!productId) return
    if (parseFloat(qty) <= 0) return

    try {
      if (editingMaterialId) {
        await updateMaterial({ materialId: editingMaterialId, quantity: qty, uomId })
      } else {
        await addMaterial({ productId, quantity: qty, uomId })
      }
      reset()
    } catch (err) {
      showApiError(err, 'Error al guardar material')
    }
  }

  const handleEdit = (m: WorkOrderMaterial) => {
    setEditingMaterialId(m.id)
    setProductId(m.component.toString())
    setQty(m.quantity_planned.toString())
    setUomId(m.uom.toString())
    // Fetch product to populate selector
    productionApi.getProduct(m.component).then((data) => {
      setProductObj(data as unknown as ProductMinimal)
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

  const stockColumns = useMemo<ColumnDef<WorkOrderMaterial>[]>(() => [
    {
      id: 'componente',
      header: 'Componente',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.component_name}</p>
          <p className="text-[10px] text-muted-foreground uppercase">{row.original.component_code}</p>
        </div>
      ),
    },
    {
      id: 'cantidad_planificada',
      header: () => <div className="text-right">Cantidad Planificada</div>,
      cell: ({ row }) => (
        <div className="text-right font-medium">{row.original.quantity_planned}</div>
      ),
    },
    {
      id: 'disponible',
      header: 'UoM',
      cell: ({ row }) => {
        const m = row.original
        return (
          <div className="text-right">
            <p className={cn('text-sm font-bold',
              (m.stock_available ?? 0) >= m.quantity_planned ? 'text-success' : 'text-destructive',
            )}>
              {m.stock_available ?? 0} {m.uom_name}
            </p>
            <p className="text-[10px] text-muted-foreground">Disponible</p>
          </div>
        )
      },
    },
    {
      id: 'costo_total',
      header: () => <div className="text-right">Costo Total</div>,
      cell: ({ row }) => (
        <DataCell.Currency value={row.original.total_cost} className="justify-end font-bold text-xs" />
      ),
    },
    {
      id: 'origen',
      header: 'Origen',
      cell: ({ row }) => <Chip size="xs">{row.original.source}</Chip>,
    },
    {
      id: 'acciones',
      header: '',
      cell: ({ row }) => {
        const m = row.original
        if (m.source !== 'MANUAL' || !isViewingCurrentStage) return null
        return (
          <DataCell.ActionGroup>
            <DataCell.Action action="edit" onClick={() => handleEdit(m)} />
            <DataCell.Action action="delete" onClick={() => setMaterialToDelete(m)} />
          </DataCell.ActionGroup>
        )
      },
    },
  ], [isViewingCurrentStage, handleEdit, setMaterialToDelete])

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <MaterialAssignmentTabs
          stockCount={stockMaterials.length}
          outsourcedCount={outsourcedMaterials.length}
          showOutsourcedTab={false}
          stockContent={
            <div className="space-y-6">
              {/* Stock materials table */}
              <div className="border rounded-md overflow-x-auto">
                <DataTable
                  columns={stockColumns}
                  data={stockMaterials}
                  variant="minimal"
                  hidePagination
                  noBorder
                  emptyState={{
                    context: 'inventory',
                    title: 'No hay materiales asignados',
                    description: 'No hay materiales de stock asignados',
                  }}
                />

              {/* Add stock material form */}
              {isViewingCurrentStage && (
                <>
                  {isAddOpen ? (
                    <div className="p-4 border rounded-md bg-muted/20 space-y-4 animate-in slide-in-from-top-2">
                      <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-2">
                          <label className="text-xs font-bold uppercase">Producto / Componente</label>
                          <ProductSelector
                            value={productId}
                            onChange={setProductId}
                            onSelect={(p) => {
                              setProductObj(p)
                              if (p?.uom) setUomId(typeof p.uom === 'object' ? p.uom.id.toString() : p.uom.toString())
                            }}
                            disabled={!!editingMaterialId}
                            shouldResolveVariants={false}
                            customFilter={(p) => {
                              if (order.main_product_id && p.id.toString() === order.main_product_id.toString()) return false
                              if (p.product_type === 'CONSUMABLE') return false
                              if (p.product_type === 'MANUFACTURABLE' && !p.requires_advanced_manufacturing) return false
                              if (p.requires_advanced_manufacturing && !p.track_inventory) return false
                              return p.product_type !== 'SERVICE'
                            }}
                          />
                          {productObj?.has_variants && (
                            <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                              <Select
                                value={productId?.toString() ?? ''}
                                onValueChange={(val) => {
                                  setProductId(val)
                                  const v = variants.find((vr) => vr.id.toString() === val)
                                  if (v?.uom) setUomId(v.uom.toString())
                                }}
                              >
                                <SelectTrigger className="h-9 w-full bg-primary/5 border-primary/20 rounded-md">
                                  <SelectValue placeholder="Seleccione variante requerida..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {variants.length > 0 ? variants.map((v) => (
                                    <SelectItem key={v.id} value={v.id.toString()}>
                                      {v.variant_display_name ?? v.name}
                                    </SelectItem>
                                  )) : loadingVariants ? (
                                    <div className="p-2 space-y-2">
                                      <Skeleton className="h-6 w-full" />
                                      <Skeleton className="h-6 w-full" />
                                    </div>
                                  ) : (
                                    <div className="p-2 text-xs text-center italic">Sin variantes disponibles</div>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                        <div className="w-full md:w-32 space-y-2">
                          <label className="text-xs font-bold uppercase">Cantidad</label>
                          <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
                        </div>
                        <div className="w-full md:w-40 space-y-2">
                          <label className="text-xs font-bold uppercase">Unidad</label>
                          <UoMSelector product={productObj as unknown as Parameters<typeof UoMSelector>[0]['product']} context="bom" value={uomId} onChange={setUomId} uoms={[]} />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={reset}>Cancelar</Button>
                          <Button size="sm" onClick={handleSave} disabled={isAddingMaterial}>
                            {isAddingMaterial ? (editingMaterialId ? 'Guardando...' : 'Añadiendo...') : (editingMaterialId ? 'Guardar' : 'Añadir')}
                          </Button>
                        </div>
                      </div>
                    </div>
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
              {/* Outsourced services list */}
              <div className="grid gap-3">
                {outsourcedMaterials.map((m: WorkOrderMaterial) => (
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
                          <span className="inline-flex items-center gap-1">
                            <DataCell.Currency value={parseFloat(m.unit_price ?? '0') * vatMultiplier} className="w-auto justify-start font-bold text-[10px] text-muted-foreground p-0 inline-flex" />
                            <span>(Bruto) c/u</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right mr-2 flex flex-col items-end">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Estimado</p>
                        <DataCell.Currency
                          value={parseFloat(String(m.quantity_planned)) * parseFloat(m.unit_price ?? '0') * vatMultiplier}
                          className="justify-end font-bold text-sm text-primary w-auto p-0 inline-flex"
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
                          <span className="text-[10px] font-medium text-muted-foreground">({m.supplier_name})</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {outsourcedMaterials.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground italic border rounded-md border-dashed">
                    No hay servicios tercerizados asignados.
                  </div>
                )}
              </div>

              {/* Outsourced services are managed in OutsourcingAssignmentStep */}
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
            ¿Eliminar <strong>{materialToDelete?.component_name}</strong> de la orden de trabajo?
            Esta acción no se puede deshacer.
          </>
        }
        variant="destructive"
        confirmText="Eliminar"
      />
    </div>
  )
}
