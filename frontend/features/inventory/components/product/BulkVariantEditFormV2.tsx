"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Product } from "@/types/entities"
import { useForm, UseFormReturn } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormField } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LabeledInput, LabeledSelect, SkeletonShell } from "@/components/shared"
import { Factory, AlertCircle, Copy, PlusCircle, DollarSign, Users } from "lucide-react"
import { Chip } from "@/components/shared"
import { cn } from "@/lib/utils"
import { showApiError } from "@/lib/errors"
import { toast } from "sonner"
import { BOMDrawer } from "@/features/production/components/BOMDrawer"
import type { ProductMinimal } from "@/features/production/types"
import { useUoMs } from "../../hooks/useUoMs"
import { useProductMutations } from "../../hooks/useProductMutations"

type ProductWithBomClone = Product & { copy_bom_from?: string }

const ALL_PRICE_INHERITANCE_OPTIONS = [
  { label: '— Mantener actual —', value: 'none' },
  { label: 'Hereda del template', value: 'INHERIT' },
  { label: 'Precio propio', value: 'OVERRIDE' },
  { label: 'Template + sobrecargo', value: 'SURCHARGE' },
]
const INHERIT_ONLY_OPTION = [
  { label: '— Mantener actual —', value: 'none' },
  { label: 'Hereda del template', value: 'INHERIT' },
]

const bulkEditSchema = z.object({
  sale_price: z.coerce.number().int("El precio debe ser un número entero").min(0).optional(),
  sale_uom: z.string().optional(),
  price_inheritance_mode: z.string().default('none'),
  price_surcharge: z.coerce.number().int("El sobrecargo debe ser un número entero").min(0).optional(),
})

type BulkEditValues = z.infer<typeof bulkEditSchema>

interface BulkVariantEditFormV2Props {
  selectedVariants: Product[]
  templateData?: Product
  availableVariants?: Product[]
  onSaved: (updatedVariants: Product[]) => void
  onCancel: () => void
}

export function BulkVariantEditFormV2({
  selectedVariants,
  templateData,
  availableVariants = [],
  onSaved,
  onCancel,
}: BulkVariantEditFormV2Props) {
  const [mounted, setMounted] = useState(false)
  const { uoms, isLoading: isUoMsLoading } = useUoMs()
    const { updateProduct } = useProductMutations()
  const [cloneSourceId, setCloneSourceId] = useState<string>('none')
  const [activeTab, setActiveTab] = useState<string>('precios')
  const [bomModalOpen, setBomModalOpen] = useState(false)

  const hasUomPrices = Array.isArray((templateData as unknown as Record<string, unknown>)?.uom_prices)
    ? ((templateData as unknown as Record<string, unknown[]>).uom_prices.length > 0)
    : false
  const priceOptions = hasUomPrices ? INHERIT_ONLY_OPTION : ALL_PRICE_INHERITANCE_OPTIONS

  const form: UseFormReturn<BulkEditValues> = useForm<BulkEditValues>({
    resolver: zodResolver(bulkEditSchema) as never,
    defaultValues: {
      sale_price: undefined,
      sale_uom: "",
      price_inheritance_mode: 'none',
      price_surcharge: undefined,
    },
  })

  useEffect(() => { setMounted(true) }, [])

  // uoms vienen de useUoMs (TanStack Query, reactivos y cacheados 1h).

  const onSubmit = async (data: BulkEditValues) => {
    if (!templateData?.id) {
      toast.error("No se puede guardar: producto padre no disponible")
      return
    }
    const mode = data.price_inheritance_mode
    const variantPayload: Record<string, unknown> = {}

    if (mode !== 'none') {
      variantPayload.price_inheritance_mode = mode
      if (mode === 'OVERRIDE' && data.sale_price !== undefined) variantPayload.sale_price = data.sale_price
      if (mode === 'SURCHARGE' && data.price_surcharge !== undefined) variantPayload.price_surcharge = data.price_surcharge
      if (mode === 'INHERIT') variantPayload.price_surcharge = null
    }
    if (data.sale_uom && data.sale_uom !== 'none') variantPayload.sale_uom = Number(data.sale_uom)

    if (Object.keys(variantPayload).length === 0) {
      toast.info("No se seleccionaron cambios.")
      return
    }

    try {
      await updateProduct({
        id: templateData.id,
        payload: {
          variant_updates: selectedVariants.map(v => ({ id: v.id, ...variantPayload })),
        } as never,
      })
      const updatedVariants = selectedVariants.map(v => ({ ...v, ...variantPayload })) as Product[]
      toast.success(`${selectedVariants.length} variantes actualizadas.`)
      onSaved(updatedVariants)
    } catch (e) {
      showApiError(e, "Error al actualizar variantes")
    }
  }

  const handleCloneBOM = () => {
    if (cloneSourceId === 'none') return
    const updatedVariants: ProductWithBomClone[] = selectedVariants.map(v => ({
      ...v,
      has_active_bom: true,
      product_type: "MANUFACTURABLE",
      copy_bom_from: cloneSourceId,
    }))
    toast.success(`LDM clonada a ${selectedVariants.length} variantes.`)
    onSaved(updatedVariants as Product[])
  }

  const handleNewBOMSuccess = async () => {
    const anchor = selectedVariants[0]
    setBomModalOpen(false)

    const others = selectedVariants.slice(1)
    if (others.length > 0 && templateData?.id) {
      try {
        await updateProduct({
          id: templateData.id,
          payload: {
            variant_updates: others.map(v => ({ id: v.id, copy_bom_from: String(anchor.id) })),
          } as never,
        })
      } catch (e) {
        console.error('Error cloning BOM to other variants', e)
        toast.error('Error al clonar LDM a otras variantes')
        return
      }
    }

    const updatedVariants: Product[] = selectedVariants.map(v => ({
      ...v,
      has_active_bom: true,
      product_type: "MANUFACTURABLE" as Product['product_type'],
    }))
    toast.success(`LDM creada y clonada a ${selectedVariants.length} variantes.`)
    onSaved(updatedVariants)
  }

  const currentMode = form.watch('price_inheritance_mode')
  const overrideNet = form.watch('sale_price') ?? 0
  const currentSurcharge = form.watch('price_surcharge') ?? 0
  const templateNet = Number(templateData?.sale_price) || 0

  const showPreview = currentMode === 'OVERRIDE' || currentMode === 'SURCHARGE'
  const previewNet = currentMode === 'OVERRIDE' ? overrideNet : templateNet + currentSurcharge

  const handleOverrideNetChange = (value: string) => {
    if (currentMode !== 'OVERRIDE') return
    form.setValue("sale_price", Math.round(parseFloat(value) || 0), { shouldDirty: true, shouldValidate: true })
  }

  const handleOverrideGrossChange = (value: string) => {
    if (currentMode !== 'OVERRIDE') return
    form.setValue("sale_price", Math.round((parseFloat(value) || 0) / 1.19), { shouldDirty: true, shouldValidate: true })
  }

  const cloneSources = [
    { label: "--- Seleccione origen ---", value: "none" },
    ...(templateData?.has_active_bom
      ? [{ label: `Template Padre (${templateData.name})`, value: 'template' }]
      : []),
    ...(availableVariants)
      .filter(v => v.has_active_bom)
      .map(v => ({ label: `Variante: ${v.variant_display_name || v.name}`, value: String(v.id) })),
  ]

  const variantsWithBOM = selectedVariants.filter(v => v.has_active_bom).length

  const anchorVariant: ProductMinimal = {
    id: selectedVariants[0]?.id,
    name: selectedVariants[0]?.variant_display_name || selectedVariants[0]?.name,
    code: selectedVariants[0]?.code,
    product_type: selectedVariants[0]?.product_type,
  }

  return (
    <>
    {mounted && createPortal(
      <form id="bulk-edit-form" onSubmit={(e) => { e.stopPropagation(); form.handleSubmit(onSubmit)(e) }} style={{ display: 'none' }} />,
      document.body
    )}
    <SkeletonShell isLoading={isUoMsLoading} ariaLabel="Cargando edición masiva">
    <div className="flex flex-col h-full bg-card rounded-md border shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">

        {/* Tab navigation */}
        <div className="px-5 pt-4 pb-1 bg-muted/5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-black uppercase tracking-widest text-primary">
              {selectedVariants.length} variantes seleccionadas
            </span>
          </div>
          <TabsList className="w-full h-9 grid grid-cols-2 bg-muted/40 rounded-md">
            <TabsTrigger value="precios" className="text-xs font-bold flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              Precios
            </TabsTrigger>
            <TabsTrigger value="ldm" className="text-xs font-bold flex items-center gap-1.5">
              <Factory className="h-3.5 w-3.5" />
              LDM
              {variantsWithBOM > 0 && (
                <span className="ml-1 bg-primary/20 text-primary text-[9px] font-black px-1.5 py-0.5 rounded-md">
                  {variantsWithBOM}/{selectedVariants.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Tab: Precios ─────────────────────────────────── */}
        <TabsContent value="precios" className="flex-1 overflow-y-auto p-6 scrollbar-thin mt-0">
          <Form {...form}>
            <div className="space-y-5">

              <FormField<BulkEditValues>
                control={form.control}
                name="price_inheritance_mode"
                render={({ field }) => (
                  <LabeledSelect
                    label="Modo de Precio"
                    value={String(field.value ?? 'none')}
                    onChange={(val) => {
                      if (hasUomPrices && val !== 'none' && val !== 'INHERIT') return
                      field.onChange(val)
                      if (val !== 'SURCHARGE') form.setValue('price_surcharge', undefined)
                      if (val !== 'OVERRIDE') form.setValue('sale_price', undefined)
                    }}
                    options={priceOptions}
                    disabled={hasUomPrices}
                    hint={hasUomPrices ? "Bloqueado: el template tiene precios por UoM configurados" : undefined}
                  />
                )}
              />

              {currentMode === 'SURCHARGE' && (
                <FormField<BulkEditValues>
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
                  value={showPreview ? String(Math.round(previewNet)) : ""}
                  placeholder="Mantener"
                  readOnly={currentMode !== 'OVERRIDE'}
                  onChange={(e) => handleOverrideNetChange(e.target.value)}
                  className={cn("h-10 font-bold text-right", currentMode !== 'OVERRIDE' && "bg-muted/30 cursor-default")}
                />
                <LabeledInput
                  label="IVA (19%)"
                  type="number"
                  value={showPreview ? (previewNet * 0.19).toFixed(2) : ""}
                  placeholder="—"
                  readOnly
                  className="h-10 font-medium text-right bg-muted/20 cursor-default text-muted-foreground"
                />
                <LabeledInput
                  label="Precio Bruto"
                  type="number"
                  step="1"
                  value={showPreview ? String(Math.round(previewNet * 1.19)) : ""}
                  placeholder="Mantener"
                  readOnly={currentMode !== 'OVERRIDE'}
                  onChange={(e) => handleOverrideGrossChange(e.target.value)}
                  className={cn("h-10 font-black text-right", currentMode !== 'OVERRIDE' && "bg-muted/30 cursor-default")}
                />
              </div>

              <FormField<BulkEditValues>
                control={form.control}
                name="sale_uom"
                render={({ field, fieldState }) => (
                  <LabeledSelect
                    label="Ud. Venta"
                    value={String(field.value || "")}
                    onChange={(val) => field.onChange(val)}
                    options={[
                      { label: "— Mantener actual —", value: "none" },
                      ...uoms.map(u => ({ label: u.name, value: u.id.toString() })),
                    ]}
                    error={fieldState.error?.message}
                    className={cn("h-10", currentMode !== 'OVERRIDE' && "bg-muted/30")}
                    disabled={currentMode !== 'OVERRIDE'}
                  />
                )}
              />

              {(currentMode === 'INHERIT' || currentMode === 'SURCHARGE') &&
                !!((templateData as unknown as Record<string, unknown>)?.discount_active) && (
                  <div className="p-3 bg-warning/10 border border-warning/20 rounded-md flex gap-2 items-center text-[11px] font-bold text-warning-foreground">
                    <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
                    El template tiene descuentos configurados. Estos se aplicarán sobre el precio final calculado de estas variantes.
                  </div>
                )}

            </div>
          </Form>
        </TabsContent>

        {/* ── Tab: LDM ─────────────────────────────────────── */}
        <TabsContent value="ldm" className="flex-1 overflow-y-auto p-6 scrollbar-thin mt-0">
          <div className="space-y-5">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black uppercase tracking-widest text-foreground">
                  Recetas de Producción
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {variantsWithBOM === selectedVariants.length
                    ? `Todas las variantes tienen LDM configurada.`
                    : variantsWithBOM > 0
                      ? `${variantsWithBOM} de ${selectedVariants.length} variantes tienen LDM.`
                      : `Ninguna variante tiene LDM configurada.`}
                </p>
              </div>
              {variantsWithBOM === selectedVariants.length
                ? <Chip intent="success">Todas configuradas</Chip>
                : variantsWithBOM > 0
                  ? <Chip intent="warning">Parcial</Chip>
                  : <Chip intent="neutral">Sin configurar</Chip>}
            </div>

            {/* Create + clone to all */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-9 text-xs font-bold border-dashed"
              onClick={() => setBomModalOpen(true)}
            >
              <PlusCircle className="h-3.5 w-3.5 mr-2" />
              Crear Receta y Clonar a Todas
            </Button>
            <p className="text-[10px] text-muted-foreground text-center -mt-2">
              Crea una receta nueva y la replica automáticamente al resto de la selección.
            </p>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-[10px]">
                <span className="bg-card px-2 text-muted-foreground font-bold uppercase tracking-widest">
                  O clonar desde existente
                </span>
              </div>
            </div>

            {/* Clone source selector */}
            {cloneSources.length <= 1 ? (
              <div className="p-3 bg-muted/10 border rounded-lg text-center">
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
                  Clonar LDM a {selectedVariants.length} Variantes
                </Button>
              </div>
            )}

          </div>
        </TabsContent>
      </Tabs>

      {/* BOM create modal — anchored to first selected variant */}
      <BOMDrawer
        open={bomModalOpen}
        onOpenChange={(open) => setBomModalOpen(open)}
        product={anchorVariant}
        onSuccess={handleNewBOMSuccess}
      />
    </div>
    </SkeletonShell>
    </>
  )
}
