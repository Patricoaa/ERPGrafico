"use client"

import { Plus, Truck, Pencil, Trash2, Info, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ProductSelector } from '@/components/selectors/ProductSelector'
import { UoMSelector } from '@/components/selectors/UoMSelector'
import { AdvancedContactSelector } from '@/components/selectors/AdvancedContactSelector'
import { formatCurrency } from '@/lib/currency'
import { showApiError } from '@/lib/errors'
import { useHubPanel } from '@/components/providers/HubPanelProvider'
import api from '@/lib/api'
import { useState } from 'react'
import type { WorkOrder, WorkOrderMaterial, ProductMinimal, UoM } from '../../types'

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

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [productId, setProductId] = useState<string | null>(null)
  const [qty, setQty] = useState('1')
  const [uomId, setUomId] = useState<string>('')
  const [productObj, setProductObj] = useState<ProductMinimal | null>(null)
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [grossPrice, setGrossPrice] = useState('0')
  const [netPrice, setNetPrice] = useState('0')
  const [documentType, setDocumentType] = useState('FACTURA')
  const [uoms] = useState<UoM[]>([])
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setIsAddOpen(false)
    setEditingId(null)
    setProductId(null)
    setQty('1')
    setUomId('')
    setProductObj(null)
    setSupplierId(null)
    setGrossPrice('0')
    setNetPrice('0')
    setDocumentType('FACTURA')
  }

  const handleSave = async () => {
    if (!productId || parseFloat(qty) <= 0 || !supplierId || parseFloat(grossPrice) <= 0) return
    setSaving(true)
    try {
      if (editingId) {
        await api.post(`/production/orders/${order.id}/update_material/`, {
          material_id: editingId, quantity: qty, uom_id: uomId,
          is_outsourced: true, supplier_id: supplierId, unit_price: netPrice, document_type: documentType,
        })
      } else {
        await api.post(`/production/orders/${order.id}/add_material/`, {
          product_id: productId, quantity: qty, uom_id: uomId,
          is_outsourced: true, supplier_id: supplierId, unit_price: netPrice, document_type: documentType,
        })
      }
      reset()
      onMaterialSaved()
    } catch (err) {
      showApiError(err, 'Error al guardar servicio')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (m: WorkOrderMaterial) => {
    setEditingId(m.id)
    setProductId(m.component.toString())
    setQty(m.quantity_planned.toString())
    setUomId(m.uom.toString())
    setSupplierId(m.supplier?.toString() ?? null)
    setNetPrice(m.unit_price?.toString() ?? '0')
    setGrossPrice(m.unit_price ? (parseFloat(m.unit_price) * 1.19).toFixed(2) : '0')
    setDocumentType(m.document_type ?? 'FACTURA')
    api.get(`/inventory/products/${m.component}/`).then((res) => {
      setProductObj(res.data)
      setIsAddOpen(true)
    })
  }

  const handleDelete = async (materialId: number) => {
    try {
      await api.post(`/production/orders/${order.id}/remove_material/`, { material_id: materialId })
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
                    <span>{formatCurrency(parseFloat(m.unit_price ?? '0') * 1.19)} (Bruto) c/u</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right mr-2">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Estimado</p>
                  <p className="text-sm font-bold text-primary">
                    {formatCurrency(parseFloat(String(m.quantity_planned)) * parseFloat(m.unit_price ?? '0') * 1.19)}
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
                  <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-border bg-muted/50 text-muted-foreground whitespace-nowrap">
                    OCS-{m.purchase_order_number}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground">({m.supplier_name})</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {isViewingCurrentStage && (
          <div className="pt-2">
            {isAddOpen ? (
              <div className="p-4 border-2 border-primary/20 rounded-md bg-primary/5 space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold uppercase">Servicio</label>
                    <ProductSelector
                      value={productId}
                      onChange={setProductId}
                      onSelect={(obj) => { setProductObj(obj); if (obj?.uom_id) setUomId(obj.uom_id.toString()) }}
                      disabled={!!editingId}
                      customFilter={(p) => p.product_type === 'SERVICE' && (p as any).can_be_purchased}
                    />
                  </div>
                  <div className="w-full md:w-32 space-y-2">
                    <label className="text-xs font-bold uppercase">Cantidad</label>
                    <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
                  </div>
                  <div className="w-full md:w-40 space-y-2">
                    <label className="text-xs font-bold uppercase">Unidad</label>
                    <UoMSelector product={productObj as any} context="bom" value={uomId} onChange={setUomId} uoms={uoms} />
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-4 w-full pt-2 border-t border-primary/10 mt-2">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold uppercase text-primary">Proveedor</label>
                    <AdvancedContactSelector value={supplierId} onChange={setSupplierId} contactType="SUPPLIER" />
                  </div>
                  <div className="w-full md:w-32 space-y-2">
                    <label className="text-xs font-bold uppercase text-primary">Precio Bruto</label>
                    <Input
                      type="number"
                      value={grossPrice}
                      onChange={(e) => {
                        setGrossPrice(e.target.value)
                        setNetPrice(e.target.value ? (parseFloat(e.target.value) / 1.19).toFixed(2) : '0')
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold uppercase text-primary">Documento</label>
                    <select
                      className="w-full rounded-md border border-primary/30 bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-primary"
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                    >
                      <option value="FACTURA">Factura</option>
                      <option value="BOLETA">Boleta</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={reset}>Cancelar</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {editingId ? 'Guardar' : 'Añadir Servicio'}
                  </Button>
                </div>
              </div>
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
