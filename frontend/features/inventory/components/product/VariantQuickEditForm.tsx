"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { type Product } from "@/types/entities"
import { useForm, type UseFormReturn } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormField } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { TabBar, TabBarContent } from "@/components/shared"
import { LabeledInput, LabeledSelect, ActionConfirmModal, SkeletonShell } from "@/components/shared"
import { Factory, Barcode, AlertCircle, Copy, CheckCircle2, PlusCircle, Pencil, Trash2, DollarSign } from "lucide-react"
import { Chip } from "@/components/shared"
import { cn } from "@/lib/utils"
import { showApiError } from "@/lib/errors"
import { toast } from "sonner"
import { BarcodeModal } from "@/features/inventory/components/BarcodeModal"
import { BOMDrawer } from "@/features/production/components/BOMDrawer"
import type { BOM, ProductMinimal } from "@/features/production/types"
import { useVatRate } from '@/hooks/useVatRate'
import { useUoMs } from "../../hooks/useUoMs"
import { useBOMs } from "@/features/production"
import { useProductMutations } from "../../hooks/useProductMutations"

const ALL_PRICE_INHERITANCE_OPTIONS = [
  { label: 'Hereda del template', value: 'INHERIT' },
  { label: 'Precio propio', value: 'OVERRIDE' },
  { label: 'Template + sobrecargo', value: 'SURCHARGE' },
]
const INHERIT_ONLY_OPTION = [{ label: 'Hereda del template', value: 'INHERIT' }]

const quickEditSchema = z.object({
  sale_price: z.coerce.number().int("El precio debe ser un número entero").min(0, "El precio no puede ser negativo"),
  code: z.string().optional(),
  sale_uom: z.string().min(1, "La unidad de medida es obligatoria"),
  price_inheritance_mode: z.enum(['INHERIT', 'OVERRIDE', 'SURCHARGE']).default('INHERIT'),
  price_surcharge: z.coerce.number().int("El sobrecargo debe ser un número entero").min(0).optional(),
})

type QuickEditValues = z.infer<typeof quickEditSchema>

interface VariantQuickEditFormProps {
  variant: Product
  templateData?: Product
  availableVariants?: Product[]
  onSaved: (updatedVariant: Product) => void
  onCancel: () => void
  onTabChange?: (tab: string) => void
}

export function VariantQuickEditForm({
  variant,
  templateData,
  availableVariants = [],
  onSaved,
}: VariantQuickEditFormProps) {
  const [mounted, setMounted] = useState(false)
  const { uoms, isUoMsLoading } = useUoMs()
  const { rate, multiplier } = useVatRate()
  const { boms: availableBOMs, deleteBom, refetch: refetchVariantBOMs, isBOMsLoading } = useBOMs({ product_id: variant.id })
  const isFetchingInitialData = isUoMsLoading || isBOMsLoading
    const { updateProduct } = useProductMutations()
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false)
  const [cloneSourceId, setCloneSourceId] = useState<string>('none')
  const [activeTab, setActiveTab] = useState<string>('precios')
  const [bomModalOpen, setBomModalOpen] = useState(false)
  const [bomToEdit, setBomToEdit] = useState<BOM | undefined>(undefined)

  const hasUomPrices = Array.isArray((templateData as any)?.uom_prices)
    ? (templateData as any).uom_prices.length > 0
    : false
  const priceOptions = hasUomPrices ? INHERIT_ONLY_OPTION : ALL_PRICE_INHERITANCE_OPTIONS

  const form: UseFormReturn<QuickEditValues> = useForm<QuickEditValues>({
    resolver: zodResolver(quickEditSchema) as any,
    defaultValues: {
      sale_price: Number(variant.sale_price) || 0,
      code: variant.code || "",
      sale_uom: variant.sale_uom?.toString() || "",
      price_inheritance_mode: hasUomPrices ? 'INHERIT' : ((variant.price_inheritance_mode ?? 'INHERIT') as 'INHERIT' | 'OVERRIDE' | 'SURCHARGE'),
      price_surcharge: variant.price_surcharge ? Number(variant.price_surcharge) : undefined,
    },
  })

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    form.reset({
      sale_price: Number(variant.sale_price) || 0,
      code: variant.code || "",
      sale_uom: variant.sale_uom?.toString() || "",
      price_inheritance_mode: hasUomPrices ? 'INHERIT' : ((variant.price_inheritance_mode ?? 'INHERIT') as 'INHERIT' | 'OVERRIDE' | 'SURCHARGE'),
      price_surcharge: variant.price_surcharge ? Number(variant.price_surcharge) : undefined,
    })
    setCloneSourceId('none')
    // uoms y availableBOMs se mantienen reactivos vía useUoMs / useBOMs —
    // ya no hace falta refetchear manualmente al cambiar de variant porque
    // el queryKey del useBOMs incluye variant.id (se re-fetchea solo).
  }, [variant])

  const [pendingDeleteBomId, setPendingDeleteBomId] = useState<number | null>(null)

  const handleDeleteBOM = (bomId: number) => setPendingDeleteBomId(bomId)

  const onConfirmDeleteBOM = async () => {
    if (pendingDeleteBomId === null) return
    try {
      // deleteBom invalida BOMS_QUERY_KEY + PRODUCTS_QUERY_KEY internamente
      // y emite su propio toast.
      await deleteBom(pendingDeleteBomId)
    } catch (e) {
      console.error(e)
      // El hook emite toast.error, pero registramos por si fuera otra causa.
      throw e
    }
  }

  const onSubmit = async (data: QuickEditValues) => {
    const mode = data.price_inheritance_mode ?? 'INHERIT'
    const payload = {
      sale_price: data.sale_price,
      code: data.code || variant.code || "",
      sale_uom: data.sale_uom ? Number(data.sale_uom) : (typeof variant.sale_uom === 'object' ? variant.sale_uom?.id : variant.sale_uom),
      price_inheritance_mode: mode,
      price_surcharge: mode === 'SURCHARGE' ? (data.price_surcharge ?? null) : null,
    }
    try {
      const res = await updateProduct({ id: variant.id, payload })
      toast.success("Variante guardada")
      onSaved({ ...variant, ...payload, ...res } as Product)
    } catch (e) {
      showApiError(e, "Error al guardar variante")
    }
  }

  const currentMode = form.watch('price_inheritance_mode')
  const templateNet = Number(templateData?.sale_price) || 0
  const currentSurcharge = form.watch('price_surcharge') || 0
  const overrideNet = form.watch('sale_price') || 0

  let effectiveNet = 0
  if (currentMode === 'INHERIT') effectiveNet = templateNet
  else if (currentMode === 'SURCHARGE') effectiveNet = templateNet + currentSurcharge
  else effectiveNet = overrideNet

  const currentIva = effectiveNet * (rate / 100)
  const currentGross = effectiveNet * multiplier

  const handleOverrideNetChange = (value: string) => {
    if (currentMode !== 'OVERRIDE') return
    form.setValue("sale_price", Math.round(parseFloat(value) || 0), { shouldDirty: true, shouldValidate: true })
  }

  const handleOverrideGrossChange = (value: string) => {
    if (currentMode !== 'OVERRIDE') return
    form.setValue("sale_price", Math.round((parseFloat(value) || 0) / multiplier), { shouldDirty: true, shouldValidate: true })
  }

  const handleCloneBOM = async () => {
    if (cloneSourceId === 'none' || !templateData?.id) return
    try {
      await updateProduct({
        id: templateData.id,
        payload: {
          variant_updates: [{ id: variant.id, copy_bom_from: cloneSourceId }],
        } as never,
      })
      toast.success("LDM clonada correctamente.")
      setCloneSourceId('none')
      // updateProduct invalida PRODUCTS_KEYS.all (cubre lista y detalle).
      // Forzamos refetch del BOMs para que el chip "tiene LDM activa" del
      // variant se actualice inmediatamente sin esperar al staleTime.
      refetchVariantBOMs()
      onSaved({ ...variant, has_active_bom: true, product_type: 'MANUFACTURABLE' } as Product)
    } catch (e) {
      showApiError(e, "Error al clonar LDM")
    }
  }

  const cloneSources = [
    { label: "--- Seleccione origen ---", value: "none" },
    ...(templateData?.has_active_bom
      ? [{ label: `Template Padre (${templateData.name})`, value: 'template' }]
      : []),
    ...(availableVariants || [])
      .filter(v => v.id !== variant.id && v.has_active_bom)
      .map(v => ({ label: `Variante: ${v.variant_display_name || v.name}`, value: String(v.id) })),
  ]

  const variantAsProductMinimal: ProductMinimal = {
    id: variant.id,
    name: variant.variant_display_name || variant.name,
    code: variant.code,
    product_type: variant.product_type,
  }

  return (
    <>
    {mounted && createPortal(
      <form id="quick-edit-form" onSubmit={(e) => { e.stopPropagation(); form.handleSubmit(onSubmit)(e) }} style={{ display: 'none' }} />,
      document.body
    )}
    <SkeletonShell isLoading={isFetchingInitialData} ariaLabel="Cargando editor rápido de variante" className="flex-1 flex flex-col">
    <div className="flex flex-col h-full bg-card rounded-md border shadow-card overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
      <TabBar
          value={activeTab}
          onValueChange={setActiveTab}
          items={[
            { value: 'precios', label: 'Precios', icon: DollarSign as any },
            { value: 'ldm', label: 'LDM', icon: Factory as any, badge: availableBOMs.length > 0 ? availableBOMs.length : undefined },
          ]}
          className="flex-1"
          contentClassName="flex flex-col p-0"
        >
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">

        {/* ── Tab: Precios ─────────────────────────────────── */}
        <TabBarContent value="precios" className="mt-0">
          <Form {...form}>
            <div className="space-y-5">

              <FormField<QuickEditValues>
                control={form.control}
                name="price_inheritance_mode"
                render={({ field }) => (
                  <LabeledSelect
                    label="Modo de Precio"
                    value={String(field.value ?? 'INHERIT')}
                    onChange={(val) => {
                      if (hasUomPrices) return
                      field.onChange(val)
                      if (val !== 'SURCHARGE') form.setValue('price_surcharge', undefined)
                      const d = form.getValues()
                      onSaved({
                        ...variant,
                        price_inheritance_mode: val as 'INHERIT' | 'OVERRIDE' | 'SURCHARGE',
                        price_surcharge: val === 'SURCHARGE' ? (d.price_surcharge ?? null) : null,
                      })
                    }}
                    options={priceOptions}
                    disabled={hasUomPrices}
                    hint={hasUomPrices ? "Bloqueado: el template tiene precios por UoM configurados" : undefined}
                  />
                )}
              />

              {form.watch('price_inheritance_mode') === 'SURCHARGE' && (
                <FormField<QuickEditValues>
                  control={form.control}
                  name="price_surcharge"
                  render={({ field, fieldState }) => (
                    <LabeledInput
                      label="Sobrecargo (Neto)"
                      type="number"
                      placeholder="0"
                      error={fieldState.error?.message}
                      className="h-10 font-bold bg-warning/5 border-warning/20"
                      value={field.value !== undefined ? String(field.value) : ""}
                      onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                    />
                  )}
                />
              )}

              <div className="grid grid-cols-3 gap-3">
                <LabeledInput
                  label="Precio Neto"
                  type="number"
                  step="1"
                  value={String(Math.round(effectiveNet))}
                  readOnly={currentMode !== 'OVERRIDE'}
                  onChange={(e) => handleOverrideNetChange(e.target.value)}
                  className={cn("h-10 font-bold text-right", currentMode !== 'OVERRIDE' && "bg-muted/30 cursor-default")}
                />
                <LabeledInput
                  label={`IVA (${rate}%)`}
                  type="number"
                  value={currentIva.toFixed(2)}
                  readOnly
                  className="h-10 font-medium text-right bg-muted/20 cursor-default text-muted-foreground"
                />
                <LabeledInput
                  label="Precio Bruto"
                  type="number"
                  step="1"
                  value={String(Math.round(currentGross))}
                  readOnly={currentMode !== 'OVERRIDE'}
                  onChange={(e) => handleOverrideGrossChange(e.target.value)}
                  className={cn("h-10 font-black text-right", currentMode !== 'OVERRIDE' && "bg-muted/30 cursor-default")}
                />
              </div>

              <FormField<QuickEditValues>
                control={form.control}
                name="sale_uom"
                render={({ field, fieldState }) => (
                  <LabeledSelect
                    label="Ud. Venta"
                    value={String(field.value || "")}
                    onChange={(val) => field.onChange(val)}
                    options={uoms.map(u => ({ label: u.name, value: u.id.toString() }))}
                    error={fieldState.error?.message}
                    className={cn("h-10", currentMode !== 'OVERRIDE' && "bg-muted/30")}
                    disabled={currentMode !== 'OVERRIDE'}
                  />
                )}
              />

              {(currentMode === 'INHERIT' || currentMode === 'SURCHARGE') &&
                (templateData as any)?.discount_active && (
                  <div className="p-3 bg-warning/10 border border-warning/20 rounded-md flex gap-2 items-center text-[11px] font-bold text-warning-foreground">
                    <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
                    El template tiene descuentos configurados. Estos se aplicarán sobre el precio final calculado de esta variante.
                  </div>
                )}

              <div className="flex items-end gap-2">
                <FormField<QuickEditValues>
                  control={form.control}
                  name="code"
                  render={({ field, fieldState }) => (
                    <LabeledInput
                      {...field}
                      label="SKU / Código de Barras"
                      placeholder="Ej: VAR-001"
                      error={fieldState.error?.message}
                      className="h-10 font-mono"
                      containerClassName="flex-1"
                    />
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-10 w-10 rounded-md border-primary/10 hover:bg-primary/5 shadow-card transition-all mb-1 self-end"
                  onClick={() => setIsBarcodeModalOpen(true)}
                  title="Generador de Barras"
                >
                  <Barcode className="h-4 w-4 text-primary" />
                </Button>
                <BarcodeModal
                  open={isBarcodeModalOpen}
                  onOpenChange={setIsBarcodeModalOpen}
                  initialValue={form.getValues("code")}
                  onApply={(val) => {
                    form.setValue("code", val, { shouldDirty: true, shouldValidate: true })
                    const d = form.getValues()
                    const mode = d.price_inheritance_mode ?? 'INHERIT'
                    onSaved({
                      ...variant,
                      code: val,
                      sale_price: d.sale_price,
                      sale_uom: d.sale_uom ? Number(d.sale_uom) : (typeof variant.sale_uom === 'object' ? variant.sale_uom?.id : variant.sale_uom),
                      price_inheritance_mode: mode,
                      price_surcharge: mode === 'SURCHARGE' ? (d.price_surcharge ?? null) : null,
                    })
                  }}
                />
              </div>

            </div>
          </Form>
        </TabBarContent>

        {/* ── Tab: LDM ─────────────────────────────────────── */}
        <TabBarContent value="ldm" className="mt-0">
          <div className="space-y-5">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black uppercase tracking-widest text-foreground">
                  Recetas de esta Variante
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {availableBOMs.length > 0
                    ? `${availableBOMs.length} receta(s) configurada(s) para esta variante.`
                    : "Esta variante aún no tiene recetas de producción propias."}
                </p>
              </div>
              {availableBOMs.length > 0
                ? <Chip intent="success">Configurada</Chip>
                : <Chip intent="neutral">Sin configurar</Chip>}
            </div>

            {/* BOM list — only BOMs of this specific variant */}
            {availableBOMs.length > 0 ? (
              <div className="space-y-2">
                {availableBOMs.map((bom) => (
                  <div
                    key={bom.id}
                    className="flex items-center justify-between p-3 rounded-md border bg-muted/10 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className={cn("h-4 w-4 shrink-0", bom.active ? "text-success" : "text-muted-foreground")} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{bom.name || `LDM #${bom.id}`}</p>
                        <span className="text-[10px] text-muted-foreground">
                          {bom.active ? "Activa" : "Inactiva"} · Rend.&nbsp;{bom.yield_quantity ?? 1}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        title="Editar receta"
                        onClick={() => { setBomToEdit(bom); setBomModalOpen(true) }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Eliminar receta"
                        onClick={() => bom.id !== undefined && handleDeleteBOM(bom.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-muted-foreground/30 p-6 text-center bg-muted/5">
                <Factory className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground font-medium">Sin recetas de producción</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  Cree una nueva receta o clone desde el template padre u otra variante.
                </p>
              </div>
            )}

            {/* New BOM button */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-9 text-xs font-bold border-dashed"
              onClick={() => { setBomToEdit(undefined); setBomModalOpen(true) }}
            >
              <PlusCircle className="h-3.5 w-3.5 mr-2" />
              Nueva Receta
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-[10px]">
                <span className="bg-card px-2 text-muted-foreground font-bold uppercase tracking-widest">
                  O clonar desde
                </span>
              </div>
            </div>

            {/* Clone source selector */}
            {cloneSources.length <= 1 ? (
              <div className="p-3 bg-muted/10 border rounded-md text-center">
                <p className="text-[11px] text-muted-foreground">
                  No hay fuentes disponibles para clonar.
                  {!templateData?.has_active_bom && " El template padre tampoco tiene LDM configurada."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <LabeledSelect
                  label="Origen a clonar"
                  value={cloneSourceId}
                  onChange={setCloneSourceId}
                  options={cloneSources}
                  className="h-10"
                />
                <Button
                  type="button"
                  className="w-full font-bold h-9"
                  variant="secondary"
                  disabled={cloneSourceId === 'none'}
                  onClick={handleCloneBOM}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Clonar LDM y Guardar
                </Button>
              </div>
            )}

          </div>
        </TabBarContent>
          </div>
        </TabBar>

      {/* BOM create / edit modal */}
      <BOMDrawer
        open={bomModalOpen}
        onOpenChange={(open) => {
          setBomModalOpen(open)
          if (!open) setBomToEdit(undefined)
        }}
        product={variantAsProductMinimal}
        bomToEdit={bomToEdit}
        onSuccess={() => {
          refetchVariantBOMs()
          setBomModalOpen(false)
          setBomToEdit(undefined)
        }}
      />

      <ActionConfirmModal
        open={pendingDeleteBomId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteBomId(null) }}
        onConfirm={onConfirmDeleteBOM}
        title="Eliminar Lista de Materiales"
        description="¿Eliminar esta lista de materiales? Esta acción no se puede deshacer."
        variant="destructive"
        confirmText="Eliminar"
      />
    </div>
    </SkeletonShell>
    </>
  )
}
