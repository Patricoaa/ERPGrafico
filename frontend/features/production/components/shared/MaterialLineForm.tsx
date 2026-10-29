"use client"

/**
 * MaterialLineForm
 *
 * Controlled add/edit form for one stock material line. Owns no state, so it
 * serves both the persisted work order (MaterialAssignmentStep) and the POS
 * draft (DraftMaterialsStep).
 */

import { Button } from '@/components/ui/button'
import { LabeledInput, Skeleton } from '@/components/shared'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ProductSelector } from '@/components/selectors/ProductSelector'
import { UoMSelector } from '@/components/selectors/UoMSelector'
import type { Product } from '@/types/entities'
import { useProductionVariants, useUoMs } from '../../hooks'
import type { ProductMinimal } from '../../types'

export interface MaterialLineValues {
  productId: string | null
  productObj: ProductMinimal | null
  qty: string
  uomId: string
}

export function emptyMaterialLine(): MaterialLineValues {
  return { productId: null, productObj: null, qty: '1', uomId: '' }
}

interface MaterialLineFormProps {
  value: MaterialLineValues
  onChange: (next: MaterialLineValues) => void
  onSave: () => void
  onCancel: () => void
  saving?: boolean
  isEditing?: boolean
  /** The finished product can't be its own component. */
  excludeProductId?: string | number | null
}

export function MaterialLineForm({ value, onChange, onSave, onCancel, saving = false, isEditing = false, excludeProductId }: MaterialLineFormProps) {
  const { variants, isVariantsLoading } = useProductionVariants(
    value.productObj?.has_variants ? value.productObj.id : undefined
  )
  // Every UoM the selector can offer; it narrows them to the component's category ("bom" context).
  const { data: uoms = [] } = useUoMs()
  const set = (patch: Partial<MaterialLineValues>) => onChange({ ...value, ...patch })
  const canSave = !!value.productId && parseFloat(value.qty) > 0

  return (
    <div className="p-4 border rounded-md bg-muted/20">
      <div className="flex flex-col md:flex-row gap-3 md:items-start">
        <div className="flex-1 min-w-0 space-y-2">
          <ProductSelector
            label="Producto / Componente"
            value={value.productId}
            // The selector fires onSelect then onChange with the same (stale) `value`: onSelect sets the
            // whole selection, onChange only handles clearing — otherwise it drops productObj/uomId.
            onChange={(id: string | null) => { if (!id) set({ productId: null, productObj: null, uomId: '' }) }}
            onSelect={(p: Product) => {
              const uomId = p?.uom ? (typeof p.uom === 'object' ? p.uom.id.toString() : p.uom.toString()) : value.uomId
              set({ productId: p.id.toString(), productObj: p as ProductMinimal, uomId })
            }}
            disabled={isEditing}
            shouldResolveVariants={false}
            productTypes={['STORABLE', 'MANUFACTURABLE']}
            customFilter={(p: Product) => {
              if (excludeProductId && p.id.toString() === excludeProductId.toString()) return false
              // Allow-list: only stock components (services, subscriptions, consumables are not materials).
              if (p.product_type !== 'STORABLE' && p.product_type !== 'MANUFACTURABLE') return false
              if (p.product_type === 'MANUFACTURABLE' && !p.requires_advanced_manufacturing) return false
              return !(p.requires_advanced_manufacturing && !p.track_inventory)
            }}
          />
          {value.productObj?.has_variants && (
            <Select
              value={value.productId ?? ''}
              onValueChange={(val) => {
                const v = variants.find((vr) => vr.id.toString() === val)
                set({ productId: val, uomId: v?.uom ? v.uom.toString() : value.uomId })
              }}
            >
              <SelectTrigger className="h-9 w-full bg-primary/5 border-primary/20 rounded-md">
                <SelectValue placeholder="Seleccione variante requerida..." />
              </SelectTrigger>
              <SelectContent>
                {variants.length > 0 ? variants.map((v) => (
                  <SelectItem key={v.id} value={v.id.toString()}>{v.variant_display_name ?? v.name}</SelectItem>
                )) : isVariantsLoading ? (
                  <div className="p-2 space-y-2"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /></div>
                ) : (
                  <div className="p-2 text-xs text-center italic">Sin variantes disponibles</div>
                )}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="w-full md:w-32">
          <LabeledInput label="Cantidad" type="number" value={value.qty} onChange={(e) => set({ qty: e.target.value })} />
        </div>
        <div className="w-full md:w-40">
          <UoMSelector
            label="Unidad"
            product={value.productObj as unknown as Parameters<typeof UoMSelector>[0]['product']}
            context="bom"
            value={value.uomId}
            onChange={(id) => set({ uomId: id })}
            uoms={uoms}
          />
        </div>
        {/* Same height as the notched fields beside them. */}
        <div className="flex gap-2">
          <Button variant="outline" type="button" className="h-notched-field" onClick={onCancel}>Cancelar</Button>
          <Button type="button" className="h-notched-field" onClick={onSave} disabled={!canSave || saving}>
            {saving ? (isEditing ? 'Guardando...' : 'Añadiendo...') : (isEditing ? 'Guardar' : 'Añadir')}
          </Button>
        </div>
      </div>
    </div>
  )
}
