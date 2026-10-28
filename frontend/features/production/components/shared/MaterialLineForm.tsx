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
import { useProductionVariants } from '../../hooks'
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
  const set = (patch: Partial<MaterialLineValues>) => onChange({ ...value, ...patch })
  const canSave = !!value.productId && parseFloat(value.qty) > 0

  return (
    <div className="p-4 border rounded-md bg-muted/20 space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 space-y-2">
          <label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">Producto / Componente</label>
          <ProductSelector
            value={value.productId}
            onChange={(id: string | null) => set({ productId: id })}
            onSelect={(p: Product) => {
              const uomId = p?.uom ? (typeof p.uom === 'object' ? p.uom.id.toString() : p.uom.toString()) : value.uomId
              set({ productObj: p as ProductMinimal, uomId })
            }}
            disabled={isEditing}
            shouldResolveVariants={false}
            productTypes={['STORABLE', 'MANUFACTURABLE']}
            customFilter={(p: Product) => {
              if (excludeProductId && p.id.toString() === excludeProductId.toString()) return false
              if (p.product_type === 'CONSUMABLE') return false
              if (p.product_type === 'MANUFACTURABLE' && !p.requires_advanced_manufacturing) return false
              if (p.requires_advanced_manufacturing && !p.track_inventory) return false
              return p.product_type !== 'SERVICE'
            }}
          />
          {value.productObj?.has_variants && (
            <div className="mt-2">
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
            </div>
          )}
        </div>
        <div className="w-full md:w-32 space-y-2">
          <LabeledInput label="Cantidad" type="number" value={value.qty} onChange={(e) => set({ qty: e.target.value })} className="h-8" />
        </div>
        <div className="w-full md:w-40 space-y-2">
          <label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">UoM</label>
          <UoMSelector
            product={value.productObj as unknown as Parameters<typeof UoMSelector>[0]['product']}
            context="bom"
            value={value.uomId}
            onChange={(id) => set({ uomId: id })}
            uoms={[]}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" type="button" onClick={onCancel}>Cancelar</Button>
          <Button size="sm" type="button" onClick={onSave} disabled={!canSave || saving}>
            {saving ? (isEditing ? 'Guardando...' : 'Añadiendo...') : (isEditing ? 'Guardar' : 'Añadir')}
          </Button>
        </div>
      </div>
    </div>
  )
}
