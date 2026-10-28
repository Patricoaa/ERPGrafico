"use client"

/**
 * OutsourcedServiceForm — TASK-101
 *
 * Reusable controlled form for capturing outsourced service data.
 * Used by:
 *   - OutsourcingAssignmentStep  (inline add/edit panel inside the wizard)
 *   - BOMDrawer                  (as the data-shape for each service_lines row)
 *
 * The component owns NO state — it is fully controlled by the parent via
 * `value` / `onChange`. This keeps it compatible with both react-hook-form
 * field arrays (BOM) and local useState (Step).
 */

import { Truck, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LabeledInput, LabeledSelect } from '@/components/shared'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ProductSelector } from '@/components/selectors/ProductSelector'
import { UoMSelector } from '@/components/selectors/UoMSelector'
import { AdvancedContactSelector } from '@/components/selectors/AdvancedContactSelector'
import { formatCurrency } from "@/lib/money"
import { useVatRate } from '@/hooks/useVatRate'
import { useCoreAllowedDteTypes } from '../../hooks/useProductionQueries'
import { useUoMs } from '../../hooks'
import type { Product } from "@/types/entities"
import type { ProductMinimal, UoM } from '../../types'

// ── Canonical shape for one outsourced service ──────────────────────────────
export interface OutsourcedServiceValues {
  productId: string | null
  productObj: ProductMinimal | null
  supplierId: string | null
  /** Display name captured at selection time (drafts have no persisted supplier to join). */
  supplierName?: string | null
  qty: string
  uomId: string
  /** Gross price (with VAT) — stored as string for input ergonomics */
  grossPrice: string
  /** Net price (without VAT) — derived from grossPrice / vatMultiplier */
  netPrice: string
  documentType: 'FACTURA' | 'BOLETA'
}

export function emptyOutsourcedService(): OutsourcedServiceValues {
  return {
    productId: null,
    productObj: null,
    supplierId: null,
    supplierName: null,
    qty: '1',
    uomId: '',
    grossPrice: '0',
    netPrice: '0',
    documentType: 'FACTURA',
  }
}

// ── Props ────────────────────────────────────────────────────────────────────
interface OutsourcedServiceFormProps {
  value: OutsourcedServiceValues
  onChange: (next: OutsourcedServiceValues) => void
  onSave: () => void
  onCancel: () => void
  saving?: boolean
  isEditing?: boolean
  /** Ids to pass to UoMSelector context */
  uoms?: UoM[]
  /** If true, the product field is read-only (editing existing) */
  productLocked?: boolean
  /** Show an informational note about automatic PO generation (Step context) */
  showInfo?: boolean
}

export function OutsourcedServiceForm({
  value,
  onChange,
  onSave,
  onCancel,
  saving = false,
  isEditing = false,
  uoms = [],
  productLocked = false,
  showInfo = true,
}: OutsourcedServiceFormProps) {
  const { multiplier: vatMultiplier } = useVatRate()
  // Fallback when the host passes no UoM list: the selector narrows them to the service's category.
  const { data: allUoms = [] } = useUoMs()

  const { data: allowedDteTypes = ["FACTURA", "BOLETA"] } = useCoreAllowedDteTypes()

  const set = (patch: Partial<OutsourcedServiceValues>) =>
    onChange({ ...value, ...patch })

  const handleGrossPriceChange = (raw: string) => {
    const net = raw ? (parseFloat(raw) / vatMultiplier).toFixed(2) : '0'
    set({ grossPrice: raw, netPrice: net })
  }

  const canSave =
    !!value.productId &&
    parseFloat(value.qty) > 0 &&
    !!value.supplierId &&
    parseFloat(value.grossPrice) > 0

  return (
    <div className="p-4 border rounded-md bg-muted/20 space-y-4 animate-in slide-in-from-top-2 duration-300">
      {/* Info banner (optional) */}
      {showInfo && (
        <div className="flex items-start gap-2 text-xs text-primary/80">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 mt-0.5 text-info/60 cursor-help shrink-0" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Los servicios tercerizados generarán automáticamente Órdenes de Compra en
                  estado Confirmado que deberán procesarse desde el Hub de la OC.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span>Se generará una Orden de Compra automáticamente al avanzar de etapa.</span>
        </div>
      )}

      {/* Row 1: Servicio · Cantidad · Unidad */}
      <div className="flex flex-col md:flex-row gap-3 md:items-start">
        <div className="flex-1 min-w-0">
          <ProductSelector
            label="Servicio"
            value={value.productId}
            // onSelect carries the whole selection; onChange (fired right after, same stale value) only clears.
            onChange={(id) => { if (!id) set({ productId: null, productObj: null, uomId: '' }) }}
            onSelect={(p: Product) => {
              const uomId = p?.uom ? (typeof p.uom === 'object' ? p.uom.id.toString() : p.uom.toString()) : value.uomId
              set({ productId: p?.id?.toString() ?? null, productObj: p as ProductMinimal, uomId })
            }}
            disabled={productLocked}
            productTypes={['SERVICE']}
            canBePurchased
          />
        </div>

        <div className="w-full md:w-28">
          <LabeledInput
            label="Cantidad"
            type="number"
            min="0.0001"
            step="any"
            value={value.qty}
            onChange={(e) => set({ qty: e.target.value })}
          />
        </div>

        <div className="w-full md:w-40">
          <UoMSelector
            label="Unidad"
            product={value.productObj as unknown as Parameters<typeof UoMSelector>[0]['product']}
            context="bom"
            value={value.uomId}
            onChange={(id) => set({ uomId: id })}
            uoms={uoms.length > 0 ? uoms : allUoms}
          />
        </div>
      </div>

      {/* Row 2: Proveedor · Precio Bruto · Documento */}
      <div className="flex flex-col md:flex-row gap-3 md:items-start w-full">
        <div className="flex-1 min-w-0">
          <AdvancedContactSelector
            label="Proveedor"
            value={value.supplierId}
            onChange={(id) => set({ supplierId: id, ...(id ? {} : { supplierName: null }) })}
            onSelectContact={(c) => set({ supplierId: String(c.id), supplierName: c.name })}
            contactType="SUPPLIER"
          />
        </div>

        <div className="w-full md:w-36">
          <LabeledInput
            label="Precio bruto"
            type="number"
            min="0"
            step="any"
            value={value.grossPrice}
            onChange={(e) => handleGrossPriceChange(e.target.value)}
            onFocus={(e) => e.target.select()}
            hint={parseFloat(value.grossPrice) > 0 ? `Neto: ${formatCurrency(parseFloat(value.netPrice))}` : undefined}
          />
        </div>

        <div className="w-full md:w-36">
          <LabeledSelect
            label="Documento"
            value={value.documentType}
            onChange={(v) => set({ documentType: v as 'FACTURA' | 'BOLETA' })}
            options={allowedDteTypes.map((t: string) => ({ value: t, label: t }))}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" className="h-notched-field" onClick={onCancel} type="button">
          Cancelar
        </Button>
        <Button
          className="h-notched-field"
          onClick={onSave}
          disabled={!canSave || saving}
          type="button"
        >
          <Truck className="mr-1.5 h-3.5 w-3.5" />
          {saving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Añadir Servicio'}
        </Button>
      </div>
    </div>
  )
}
