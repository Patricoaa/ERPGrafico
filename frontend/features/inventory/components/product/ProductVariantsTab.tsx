"use client"

import { formatCurrency } from "@/lib/money"
import { showApiError } from "@/lib/errors"
import React, {useState, useMemo} from "react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { Button } from "@/components/ui/button"
import { Layers, Wand2, X, Archive } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { Product, ProductAttributeValue } from "@/types/entities"
import { ProductInitialData } from "@/types/forms"
import { ActionConfirmModal, Chip, DataCell, MultiSelectOption, MultiSelectTagInput } from '@/components/shared'

import { VariantQuickEditForm } from "./VariantQuickEditForm"
import { BulkVariantEditFormV2 } from "./BulkVariantEditFormV2"
import { useConfirmAction } from "@/hooks/useConfirmAction"

import { useAttributes } from "../../hooks/useAttributes"
import { useVariants } from "../../hooks/useVariants"
import { useProducts } from "../../hooks/useProducts"
interface ProductVariantsTabProps {
    form: UseFormReturn<ProductFormValues>
    initialData?: ProductInitialData | Partial<Product>
    onEditVariant?: (variant: Product) => void
    onTabChange?: (tab: string) => void
}

interface Attribute {
    id: number
    name: string
    values: AttributeValue[]
}

interface AttributeValue {
    id: number
    value: string
}

export function ProductVariantsTab({ form, initialData, onEditVariant, onTabChange }: ProductVariantsTabProps) {
    // Attributes y attribute-values vienen unidos por useAttributes.
    // Cast: el hook tipa AttributeValue con name/code pero el serializer
    // del backend usa { value } — el componente trabaja con la forma runtime.
    const { attributes: hookAttributes } = useAttributes()
    const availableAttributes = hookAttributes as unknown as Attribute[]

    // Variants del template (incluye archivadas — la vista admin las muestra grises).
    const { data: variantsData, refetch: refetchVariants } = useVariants({
        productId: initialData?.id,
        activeOnly: false,
    })
    const variants = (variantsData ?? []) as Product[]

    const { updateProduct, generateVariants, isGeneratingVariants: isGenerating } = useProducts()
    const { createAttributeValue } = useAttributes()

    const [selectedValues, setSelectedValues] = useState<Record<number, number[]>>({})
    const [isPendingGeneration, setIsPendingGeneration] = useState(false)

    // Master-Detail State
    const [selectedVariantIds, setSelectedVariantIds] = useState<number[]>([])
    const [variantToDelete, setVariantToDelete] = useState<Product | null>(null)

    const handleMultiSelectChange = (attrId: number, selectedValueStrs: string[]) => {
        setSelectedValues(prev => ({
            ...prev,
            [attrId]: selectedValueStrs.map(v => Number(v))
        }))
    }

    const handleCreateAttributeValue = async (attrId: number, value: string) => {
        try {
            const newVal = await createAttributeValue({ attribute: attrId, value })
            toast.success(`Valor "${value}" creado`)
            // useAttributes invalida ATTRIBUTES_QUERY_KEY → el listado de
            // attributes+values se recompone solo. Auto-seleccionamos el nuevo.
            setSelectedValues(prev => {
                const current = prev[attrId] || []
                return { ...prev, [attrId]: [...current, (newVal as { id: number }).id] }
            })
        } catch (error) {
            showApiError(error, "Error al crear valor de atributo")
        }
    }

    const deleteConfirm = useConfirmAction(async () => {
        if (!variantToDelete) return
        const variant = variantToDelete
        try {
            await updateProduct({ id: variant.id, payload: { active: false } as never })
            toast.success("Variante archivada exitosamente")
            setSelectedVariantIds(prev => prev.filter(id => id !== variant.id))
            // updateProduct invalida PRODUCTS_KEYS.all → variants list incluida.
            // Forzamos refetch explícito para reflejar el cambio en la tabla local
            // sin esperar al stale time.
            refetchVariants()
        } catch (error) {
            console.error("Failed to archive variant", error)
            showApiError(error, "Error al archivar variante")
        } finally {
            setVariantToDelete(null)
        }
    })

    const handleDeleteVariant = (variant: Product, e: React.MouseEvent) => {
        e.stopPropagation()
        setVariantToDelete(variant)
        deleteConfirm.requestConfirm()
    }

    // (Removed old sync/clone/surcharge handlers)

    const handleGenerateVariants = async () => {
        const selection = Object.entries(selectedValues).map(([id, vals]) => ({
            attribute: Number(id),
            values: vals
        })).filter(item => item.values.length > 0)

        if (selection.length === 0) {
            toast.error("Seleccione al menos un valor de atributo")
            return
        }

        if (!initialData?.id) {
            // Case: New Product Workflow
            form.setValue("variant_generation_selection", selection, { shouldDirty: true })
            setIsPendingGeneration(true)
            toast.success("Configuración de variantes guardada. Se generarán automáticamente al guardar el producto.")
            setSelectedValues({})
            return
        }

        // Case: Existing Product Workflow.
        // generateVariants invalida PRODUCTS_KEYS.all + ['inventory','variants']
        // → la tabla se refresca automáticamente. isGenerating viene del hook.
        try {
            await generateVariants({ templateId: initialData.id, selection })
            toast.success("Variantes generadas con éxito")
            setSelectedValues({})
        } catch (error: unknown) {
            showApiError(error, "Error al generar variantes")
        }
    }

    // Selection Handlers
    const toggleSelectAll = () => {
        if (selectedVariantIds.length === variants.length && variants.length > 0) {
            setSelectedVariantIds([])
        } else {
            setSelectedVariantIds(variants.map(v => v.id))
        }
    }

    const toggleVariantSelect = (id: number) => {
        setSelectedVariantIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(vid => vid !== id)
            } else {
                return [...prev, id]
            }
        })
    }

    const activeEditVariant = useMemo(() => {
        if (selectedVariantIds.length === 1) {
            return variants.find(v => v.id === selectedVariantIds[0]) || null;
        }
        return null;
    }, [selectedVariantIds, variants])

    const selectedVariantsList = useMemo(() => {
        return variants.filter(v => selectedVariantIds.includes(v.id))
    }, [selectedVariantIds, variants])

    // If it's a variant itself, we don't show the generator
    if (form.watch("parent_template")) {
        return (
            <div className="mt-0 p-6 text-center space-y-4">
                <div className="flex flex-col items-center justify-center py-12 bg-muted/20 rounded-md border-2 border-dashed">
                    <Layers className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-bold">Este producto es una variante</h3>
                    <p className="text-sm text-muted-foreground">
                        Las variantes se gestionan desde el producto plantilla.
                    </p>
                    {initialData?.parent_template && (
                        <Button type="button" variant="link" className="mt-2">Ver Plantilla Origen</Button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="mt-0 space-y-2 flex flex-col h-[650px] animate-in fade-in duration-500">
            {/* Header / Actions */}
            <div className="flex items-center justify-between bg-card p-4 rounded-md border border-primary/20">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
                        <Layers className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-primary">
                            {selectedVariantIds.length > 1
                                ? `Edición Masiva (${selectedVariantIds.length} variantes)`
                                : selectedVariantIds.length === 1
                                    ? `Editar Variante`
                                    : `Generador de Variantes`
                            }
                        </h3>
                        {selectedVariantIds.length > 0 || activeEditVariant ? (
                            <p className="text-[10px] text-muted-foreground font-bold italic">Modifique los campos y guarde los cambios.</p>
                        ) : (
                            <p className="text-[10px] text-muted-foreground font-bold italic">Seleccione los atributos para combinar.</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {selectedVariantIds.length > 1 ? (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 px-4 text-[10px] font-black uppercase tracking-widest"
                                onClick={() => setSelectedVariantIds([])}
                            >
                                <X className="h-3.5 w-3.5 mr-2" />
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                form="bulk-edit-form"
                                size="sm"
                                className="h-9 px-5 text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground hover:scale-[1.02]"
                            >
                                Guardar Variantes
                            </Button>
                        </>
                    ) : selectedVariantIds.length === 1 ? (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 px-4 text-[10px] font-black uppercase tracking-widest"
                                onClick={() => setSelectedVariantIds([])}
                            >
                                <X className="h-3.5 w-3.5 mr-2" />
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                form="quick-edit-form"
                                size="sm"
                                className="h-9 px-5 text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground hover:scale-[1.02]"
                            >
                                Guardar Variante
                            </Button>
                        </>
                    ) : (
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            {variants.length} variantes
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 flex gap-4 overflow-hidden relative animate-in fade-in slide-in-from-left-8 duration-300">
                {/* Left: Master Table */}
                <div className={cn(
                    "flex-1 rounded-md border bg-card overflow-hidden flex flex-col transition-all duration-300",
                    "md:w-1/2 lg:w-7/12"
                )}>
                    <div className="overflow-y-auto scrollbar-thin flex-1">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="w-12 pl-4">
                                        <Checkbox
                                            checked={variants.length > 0 && selectedVariantIds.length === variants.length}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead className="font-bold">ID</TableHead>
                                    <TableHead className="font-bold">Atributos</TableHead>
                                    <TableHead className="font-bold text-center">Modo de precio</TableHead>
                                    <TableHead className="font-bold text-center">Precio</TableHead>
                                    <TableHead className="font-bold text-center">LDM</TableHead>
                                    <TableHead className="font-bold text-center">Disp.</TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {variants.map(v => {
                                    const isSelected = selectedVariantIds.includes(v.id);

                                    return (
                                        <TableRow
                                            key={v.id}
                                            className={cn(
                                                "cursor-pointer group transition-colors",
                                                "hover:bg-muted/50",
                                                isSelected && "bg-primary/10/50 hover:bg-primary/10/80"
                                            )}
                                            onClick={() => toggleVariantSelect(v.id)}
                                        >
                                            <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleVariantSelect(v.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border bg-muted/30 border-border/50 text-muted-foreground font-mono">
                                                    {v.internal_code || v.code || 'SIN SKU'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1 flex-wrap">
                                                    {v.attribute_values_data?.map((av: ProductAttributeValue, valIndex: number) => (
                                                        <Chip key={valIndex} size="xs">{av.value}</Chip>
                                                    ))}
                                                    {(!v.attribute_values_data || v.attribute_values_data.length === 0) && (
                                                        <span className="text-xs text-muted-foreground/50">-</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {(() => {
                                                    const mode = v.price_inheritance_mode ?? 'INHERIT'
                                                    if (mode === 'SURCHARGE') return <Chip size="xs" intent="warning">+Sobrecargo</Chip>
                                                    if (mode === 'OVERRIDE') return <Chip size="xs" intent="primary">Propio</Chip>
                                                    return <Chip size="xs" intent="neutral">Hereda</Chip>
                                                })()}
                                            </TableCell>
                                            <TableCell className="text-center font-medium text-xs tabular-nums">
                                                {formatCurrency(Number(v.effective_price_net ?? v.sale_price))}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {v.has_active_bom ? (
                                                    <Chip intent="success">CON LDM</Chip>
                                                ) : (
                                                    v.mfg_auto_finalize ? (
                                                        <Chip intent="destructive">SIN LDM</Chip>
                                                    ) : (
                                                        <span className="text-[9px] text-muted-foreground/40 font-bold">-</span>
                                                    )
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {v.has_active_bom ? (
                                                    <Chip size="xs" intent={(v.current_stock ?? 0) > 0 ? "success" : "destructive"}>
                                                        STOCK: {v.current_stock || 0}
                                                    </Chip>
                                                ) : (
                                                    (v.product_type === 'MANUFACTURABLE' || v.requires_advanced_manufacturing) ? (
                                                        <Chip size="xs" intent="primary">Disp</Chip>
                                                    ) : (
                                                        <Chip size="xs" intent={(v.current_stock ?? 0) > 0 ? "success" : "destructive"}>
                                                            {v.current_stock}
                                                        </Chip>
                                                    )
                                                )}
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <div>
                                                    <DataCell.ActionGroup>
                                                        <DataCell.Action
                                                            icon={Archive}
                                                            title="Archivar variante"
                                                            onClick={(e) => handleDeleteVariant(v, e)}
                                                        />
                                                    </DataCell.ActionGroup>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                                {variants.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic text-sm">
                                            {isPendingGeneration ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className="text-primary font-bold">Variantes configuradas</span>
                                                    <span className="text-xs">Se generarán automáticamente una vez que guarde este producto.</span>
                                                </div>
                                            ) : (
                                                <>
                                                    No se han generado variantes para este producto.
                                                    <br />
                                                    <span className="text-xs mt-1 block">Utilice el generador a la derecha.</span>
                                                </>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Right: Detail View / Generator */}
                <div className="w-full md:w-1/2 lg:w-5/12 flex-shrink-0 h-full">
                    {selectedVariantIds.length > 1 ? (
                        <BulkVariantEditFormV2
                            selectedVariants={selectedVariantsList}
                            availableVariants={variants}
                            templateData={initialData as Product | undefined}
                            onSaved={(_updatedVariants: Product[]) => {
                                refetchVariants();
                                setSelectedVariantIds([]);
                            }}
                            onCancel={() => setSelectedVariantIds([])}
                        />
                    ) : selectedVariantIds.length === 1 && activeEditVariant ? (
                        <VariantQuickEditForm
                            variant={activeEditVariant}
                            templateData={initialData as Product | undefined}
                            availableVariants={variants}
                            onSaved={(_updatedVariant: Product) => {
                                refetchVariants();
                            }}
                            onCancel={() => setSelectedVariantIds([])}
                            onTabChange={(tab: string) => onTabChange?.(tab)}
                        />
                    ) : (
                        <div className="w-full h-full flex-1 flex flex-col min-h-0 bg-card rounded-md border p-5 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin pb-4">
                                <div className="flex flex-col gap-y-6">
                                    {availableAttributes.map(attr => {
                                        const options: MultiSelectOption[] = attr.values.map(v => ({
                                            label: v.value,
                                            value: String(v.id)
                                        }))
                                        const selectedStrs = (selectedValues[attr.id] || []).map(String)

                                        return (
                                            <div key={attr.id} className="flex flex-col">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Layers className="h-4 w-4 text-primary" />
                                                    <h4 className="font-bold text-sm uppercase tracking-wider text-foreground/80">{attr.name}</h4>
                                                </div>
                                                <MultiSelectTagInput
                                                    placeholder="Buscar o crear..."
                                                    options={options}
                                                    value={selectedStrs}
                                                    onChange={(val) => handleMultiSelectChange(attr.id, val)}
                                                    onCreateOption={(val) => handleCreateAttributeValue(attr.id, val)}
                                                />
                                            </div>
                                        )
                                    })}
                                    {availableAttributes.length === 0 && (
                                        <div className="text-center text-sm text-muted-foreground italic py-8">
                                            No hay atributos configurados en el sistema.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="shrink-0 pt-4 mt-4">
                                <Button
                                    type="button"
                                    className="w-full rounded-md font-black uppercase tracking-widest text-[11px] shadow-md bg-primary hover:bg-primary/90 text-primary-foreground transition-all hover:scale-[1.01] active:scale-[0.98]"
                                    onClick={handleGenerateVariants}
                                    disabled={isGenerating || availableAttributes.length === 0}
                                >
                                    <Wand2 className="h-3.5 w-3.5 mr-2" />
                                    {isGenerating ? "Procesando..." : !initialData?.id ? "Fijar Configuración" : "Generar variantes"}
                                </Button>

                                {!initialData?.id && (
                                    <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-xl">
                                        <p className="text-[10px] text-warning text-center font-black uppercase tracking-tighter italic">
                                            * Las variantes se crearán automáticamente al guardar la ficha principal del producto.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        deleteConfirm.cancel()
                        setVariantToDelete(null)
                    }
                }}
                onConfirm={deleteConfirm.confirm}
                title="Archivar Variante"
                description={`¿Archivar la variante "${variantToDelete?.variant_display_name || variantToDelete?.name || ''}"? Dejará de aparecer en listas pero no se eliminará del sistema.`}
                variant="destructive"
            />
        </div>
    )
}
