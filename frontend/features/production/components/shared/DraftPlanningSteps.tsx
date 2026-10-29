"use client"

/**
 * Draft material / outsourcing steps
 *
 * Same forms as wizard steps 4 and 5 (MaterialLineForm, OutsourcedServiceForm),
 * but backed by a plain array instead of a persisted work order. Used by the
 * POS manufacturing drawer, where the OT doesn't exist yet: the drafts travel
 * inside the sale line's `manufacturing_data` and the backend applies them when
 * it creates the OT.
 */

import { useState } from 'react'
import { Plus, Truck, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataCell } from '@/components/shared'
import { formatCurrency } from '@/lib/money'
import { useVatRate } from '@/hooks/useVatRate'
import { PlanningEmptyState } from './PlanningEmptyState'
import { MaterialLineForm, emptyMaterialLine, type MaterialLineValues } from './MaterialLineForm'
import { OutsourcedServiceForm, emptyOutsourcedService, type OutsourcedServiceValues } from './OutsourcedServiceForm'

export interface DraftMaterial {
  product_id: number
  product_name: string
  quantity: string
  uom_id: number | null
  uom_name?: string | null
}

export interface DraftOutsourcedService {
  product_id: number
  product_name: string
  supplier_id: number
  supplier_name: string
  quantity: string
  uom_id: number | null
  uom_name?: string | null
  /** Net unit price, same convention as WorkOrderMaterial.unit_price. */
  unit_price: string
  document_type: 'FACTURA' | 'BOLETA'
}

interface DraftListProps<T> {
  items: T[]
  onChange: (next: T[]) => void
}

export function DraftMaterialsStep({ items, onChange }: DraftListProps<DraftMaterial>) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [line, setLine] = useState<MaterialLineValues>(emptyMaterialLine())

  const reset = () => { setOpen(false); setEditing(null); setLine(emptyMaterialLine()) }

  const save = () => {
    if (!line.productId || !line.productObj || parseFloat(line.qty) <= 0) return
    const next: DraftMaterial = {
      product_id: Number(line.productId),
      product_name: line.productObj.name,
      quantity: line.qty,
      uom_id: line.uomId ? Number(line.uomId) : null,
      uom_name: line.productObj.uom_name ?? null,
    }
    onChange(editing === null ? [...items, next] : items.map((m, i) => (i === editing ? next : m)))
    reset()
  }

  const openAdd = () => { reset(); setOpen(true) }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {items.length === 0 && !open && (
        <PlanningEmptyState
          kind="materials"
          action={<Button type="button" variant="outline" size="sm" onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Agregar material de stock</Button>}
        />
      )}
      <div className="grid gap-2">
        {items.map((m, i) => (
          <div key={`${m.product_id}-${i}`} className="flex items-center justify-between gap-3 p-3 border rounded-md bg-card">
            <div className="flex items-center gap-3 min-w-0">
              <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{m.product_name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{m.quantity} {m.uom_name ?? ''}</p>
              </div>
            </div>
            <DataCell.ActionGroup>
              <DataCell.Action action="edit" onClick={() => {
                setEditing(i)
                setLine({ productId: String(m.product_id), productObj: { id: m.product_id, name: m.product_name } as MaterialLineValues['productObj'], qty: m.quantity, uomId: m.uom_id ? String(m.uom_id) : '' })
                setOpen(true)
              }} />
              <DataCell.Action action="delete" onClick={() => onChange(items.filter((_, j) => j !== i))} />
            </DataCell.ActionGroup>
          </div>
        ))}
      </div>
      {open ? (
        <MaterialLineForm value={line} onChange={setLine} onSave={save} onCancel={reset} isEditing={editing !== null} />
      ) : items.length > 0 && (
        <Button type="button" variant="outline" size="sm" className="w-full border-dashed" onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />Agregar material de stock
        </Button>
      )}
    </div>
  )
}

export function DraftOutsourcingStep({ items, onChange }: DraftListProps<DraftOutsourcedService>) {
  const { multiplier: vat } = useVatRate()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState<OutsourcedServiceValues>(emptyOutsourcedService())

  const reset = () => { setOpen(false); setEditing(null); setForm(emptyOutsourcedService()) }

  const save = () => {
    if (!form.productId || !form.productObj || !form.supplierId || parseFloat(form.qty) <= 0 || parseFloat(form.grossPrice) <= 0) return
    const next: DraftOutsourcedService = {
      product_id: Number(form.productId),
      product_name: form.productObj.name,
      supplier_id: Number(form.supplierId),
      supplier_name: form.supplierName ?? `Proveedor #${form.supplierId}`,
      quantity: form.qty,
      uom_id: form.uomId ? Number(form.uomId) : null,
      uom_name: form.productObj.uom_name ?? null,
      unit_price: form.netPrice,
      document_type: form.documentType,
    }
    onChange(editing === null ? [...items, next] : items.map((m, i) => (i === editing ? next : m)))
    reset()
  }

  const openAdd = () => { reset(); setOpen(true) }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {items.length === 0 && !open && (
        <PlanningEmptyState
          kind="outsourcing"
          action={<Button type="button" variant="outline" size="sm" onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Agregar servicio tercerizado</Button>}
        />
      )}
      <div className="grid gap-2">
        {items.map((s, i) => (
          <div key={`${s.product_id}-${i}`} className="flex items-center justify-between gap-3 p-3 border rounded-md bg-card">
            <div className="flex items-center gap-3 min-w-0">
              <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{s.product_name}</p>
                <p className="text-xs text-muted-foreground tabular-nums truncate">
                  {s.supplier_name} · {s.quantity} {s.uom_name ?? ''} · {formatCurrency(parseFloat(s.unit_price) * vat)} c/u
                </p>
              </div>
            </div>
            <DataCell.ActionGroup>
              <DataCell.Action action="edit" onClick={() => {
                setEditing(i)
                setForm({
                  productId: String(s.product_id),
                  productObj: { id: s.product_id, name: s.product_name } as OutsourcedServiceValues['productObj'],
                  supplierId: String(s.supplier_id),
                  supplierName: s.supplier_name,
                  qty: s.quantity,
                  uomId: s.uom_id ? String(s.uom_id) : '',
                  netPrice: s.unit_price,
                  grossPrice: (parseFloat(s.unit_price) * vat).toFixed(2),
                  documentType: s.document_type,
                })
                setOpen(true)
              }} />
              <DataCell.Action action="delete" onClick={() => onChange(items.filter((_, j) => j !== i))} />
            </DataCell.ActionGroup>
          </div>
        ))}
      </div>
      {open ? (
        <OutsourcedServiceForm value={form} onChange={setForm} onSave={save} onCancel={reset} isEditing={editing !== null} productLocked={editing !== null} showInfo={false} />
      ) : items.length > 0 && (
        <Button type="button" variant="outline" size="sm" className="w-full border-dashed" onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />Agregar servicio tercerizado
        </Button>
      )}
    </div>
  )
}
