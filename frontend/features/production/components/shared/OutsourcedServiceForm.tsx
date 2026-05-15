"use client"

/**
 * OutsourcedServiceForm — TASK-101
 *
 * Reusable controlled form for capturing outsourced service data.
 * Used by:
 *   - OutsourcingAssignmentStep  (inline add/edit panel inside the wizard)
 *   - BOMFormModal               (as the data-shape for each service_lines row)
 *
 * The component owns NO state — it is fully controlled by the parent via
 * `value` / `onChange`. This keeps it compatible with both react-hook-form
 * field arrays (BOM) and local useState (Step).
 */

import { Truck, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ProductSelector } from '@/components/selectors/ProductSelector'
import { UoMSelector } from '@/components/selectors/UoMSelector'
import { AdvancedContactSelector } from '@/components/selectors/AdvancedContactSelector'
import { formatCurrency } from '@/lib/currency'
import { useVatRate } from '@/hooks/useVatRate'
import { useQuery } from '@tanstack/react-query'
import type { ProductMinimal, UoM } from '../../types'

// ── Canonical shape for one outsourced service ──────────────────────────────
export interface OutsourcedServiceValues {
  productId: string | null
  productObj: ProductMinimal | null
  supplierId: string | null
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

  const { data: allowedDteTypes = ["FACTURA", "BOLETA"] } = useQuery({
    queryKey: ['settings', 'general'],
    queryFn: async () => {
      const { default: api } = await import('@/lib/api')
      const res = await api.get('/core/settings/')
      return res.data.allowed_dte_types_receive || ["FACTURA", "BOLETA"]
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  })

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
    <div className="p-4 border-2 border-primary/20 rounded-md bg-primary/5 space-y-4 animate-in slide-in-from-top-2 duration-300">
      {/* Info banner (optional) */}
      {showInfo && (
        <div className="flex items-start gap-2 text-xs text-primary/80">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 mt-0.5 text-info/60 cursor-help shrink-0" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs bg-info text-white border-info">
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
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 space-y-2">
          <label className="text-xs font-bold uppercase">Servicio</label>
          <ProductSelector
            value={value.productId}
            onChange={(id) => set({ productId: id })}
            onSelect={(p) => {
              const uomId = p?.uom_id ? p.uom_id.toString() : value.uomId
              set({ productId: p?.id?.toString() ?? null, productObj: p ?? null, uomId })
            }}
            disabled={productLocked}
            customFilter={(p) =>
              p.product_type === 'SERVICE' && !!(p as any).can_be_purchased
            }
          />
        </div>

        <div className="w-full md:w-28 space-y-2">
          <label className="text-xs font-bold uppercase">Cantidad</label>
          <Input
            type="number"
            min="0.0001"
            step="any"
            value={value.qty}
            onChange={(e) => set({ qty: e.target.value })}
          />
        </div>

        <div className="w-full md:w-40 space-y-2">
          <label className="text-xs font-bold uppercase">Unidad</label>
          <UoMSelector
            product={value.productObj as any}
            context="bom"
            value={value.uomId}
            onChange={(id) => set({ uomId: id })}
            uoms={uoms}
          />
        </div>
      </div>

      {/* Row 2: Proveedor · Precio Bruto · Documento */}
      <div className="flex flex-col md:flex-row gap-4 w-full pt-2 border-t border-primary/10">
        <div className="flex-1 space-y-2">
          <label className="text-xs font-bold uppercase text-primary">Proveedor</label>
          <AdvancedContactSelector
            value={value.supplierId}
            onChange={(id) => set({ supplierId: id })}
            contactType="SUPPLIER"
          />
        </div>

        <div className="w-full md:w-36 space-y-2">
          <label className="text-xs font-bold uppercase text-primary">Precio Bruto</label>
          <Input
            type="number"
            min="0"
            step="any"
            value={value.grossPrice}
            onChange={(e) => handleGrossPriceChange(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
          {parseFloat(value.grossPrice) > 0 && (
            <p className="text-[10px] text-muted-foreground font-mono">
              Neto: {formatCurrency(parseFloat(value.netPrice))}
            </p>
          )}
        </div>

        <div className="w-full md:w-32 space-y-2">
          <label className="text-xs font-bold uppercase text-primary">Documento</label>
          <select
            className="w-full rounded-md border border-primary/30 bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-primary"
            value={value.documentType}
            onChange={(e) =>
              set({ documentType: e.target.value as 'FACTURA' | 'BOLETA' })
            }
          >
            {allowedDteTypes.map((t: string) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} type="button">
          Cancelar
        </Button>
        <Button
          size="sm"
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
