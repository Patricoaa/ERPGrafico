"use client"

import { showApiError } from "@/lib/errors"
import React, { useEffect, useState, useMemo } from "react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { Button } from "@/components/ui/button"
import { Trash2, RefreshCw, Layers, Pencil, Wand2 } from "lucide-react"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import api from "@/lib/api"
import { toast } from "sonner"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SheetCloseButton } from "@/components/shared/SheetCloseButton"
import { BaseModal } from "@/components/shared/BaseModal"
import { getErrorMessage } from "@/lib/errors"
import { Product, ProductAttributeValue } from "@/types/entities"
import { Badge } from "@/components/ui/badge"
import { ProductInitialData } from "@/types/forms"
import { FormTabsContent, FormSection } from "@/components/shared"

import { VariantQuickEditForm } from "./VariantQuickEditForm"
import { BulkVariantEditForm } from "./BulkVariantEditForm"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

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
    const [availableAttributes, setAvailableAttributes] = useState<Attribute[]>([])
    const [selectedValues, setSelectedValues] = useState<Record<number, number[]>>({})
    const [isGenerating, setIsGenerating] = useState(false)
    const [variants, setVariants] = useState<Product[]>([])
    const [isSheetOpen, setIsSheetOpen] = useState(false)
    const [isPendingGeneration, setIsPendingGeneration] = useState(false)

    // Master-Detail State
    const [selectedVariantIds, setSelectedVariantIds] = useState<number[]>([])
    const [activeEditVariantId, setActiveEditVariantId] = useState<number | null>(null)
    const [variantToDelete, setVariantToDelete] = useState<Product | null>(null)

    useEffect(() => {
        fetchAttributes()
        if (initialData?.id) {
            fetchVariants()
        }
    }, [initialData])

    const fetchAttributes = async () => {
        try {
            const [attrRes, valRes] = await Promise.all([
                api.get("/inventory/attributes/"),
                api.get("/inventory/attribute-values/")
            ])
            const attrs = attrRes.data.results || attrRes.data
            const vals = valRes.data.results || valRes.data

            const enriched = attrs.map((a: Attribute) => ({
                ...a,
                values: vals.filter((v: AttributeValue & { attribute: number }) => v.attribute === a.id)
            }))
            setAvailableAttributes(enriched)
        } catch (error) {
            console.error("Failed to fetch attributes", error)
        }
    }

    const fetchVariants = async () => {
        try {
            const res = await api.get(`/inventory/products/?parent_template=${initialData?.id}&show_technical_variants=true`)
            setVariants(res.data.results || res.data)
        } catch (error) {
            console.error("Failed to fetch variants", error)
        }
    }

    const toggleValue = (attrId: number, valueId: number) => {
        setSelectedValues(prev => {
            const current = prev[attrId] || []
            if (current.includes(valueId)) {
                return { ...prev, [attrId]: current.filter(v => v !== valueId) }
            } else {
                return { ...prev, [attrId]: [...current, valueId] }
            }
        })
    }

    const deleteConfirm = useConfirmAction(async () => {
        if (!variantToDelete) return
        const variant = variantToDelete
        try {
            await api.delete(`/inventory/products/${variant.id}/`)
            toast.success("Variante eliminada exitosamente")
            if (activeEditVariantId === variant.id) setActiveEditVariantId(null)
            setSelectedVariantIds(prev => prev.filter(id => id !== variant.id))
            fetchVariants()
        } catch (error) {
            console.error("Failed to delete variant", error)
            showApiError(error, "Error al eliminar variante")
        } finally {
            setVariantToDelete(null)
        }
    })

    const handleDeleteVariant = (variant: Product, e: React.MouseEvent) => {
        e.stopPropagation()
        setVariantToDelete(variant)
        deleteConfirm.requestConfirm()
    }

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
            setIsSheetOpen(false)
            return
        }

        // Case: Existing Product Workflow
        setIsGenerating(true)
        try {
            await api.post(`/inventory/products/${initialData.id}/generate_variants/`, {
                selection
            })

            toast.success("Variantes generadas con éxito")
            fetchVariants()
            setSelectedValues({})
            setIsSheetOpen(false)
        } catch (error: unknown) {
            showApiError(error, "Error al generar variantes")
        } finally {
            setIsGenerating(false)
        }
    }

    // Selection Handlers
    const toggleSelectAll = () => {
        if (selectedVariantIds.length === variants.length && variants.length > 0) {
            setSelectedVariantIds([])
        } else {
            setSelectedVariantIds(variants.map(v => v.id))
            setActiveEditVariantId(null) // Clear individual edit when bulk selecting
        }
    }

    const toggleVariantSelect = (id: number) => {
        setSelectedVariantIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(vid => vid !== id)
            } else {
                setActiveEditVariantId(null) // Focus changes to bulk if selecting multiples
                return [...prev, id]
            }
        })
    }

    const handleRowClick = (id: number) => {
        // If we are in bulk mode and clicking another row, behavior could be to add to selection
        // But traditional master-detail means row click = view details.
        // Let's clear bulk selection and show detail for this row.
        setSelectedVariantIds([])
        if (activeEditVariantId === id) {
            // Toggle off
            setActiveEditVariantId(null)
        } else {
            setActiveEditVariantId(id)
        }
    }

    const activeEditVariant = useMemo(() => {
        return variants.find(v => v.id === activeEditVariantId)
    }, [activeEditVariantId, variants])

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
                        <Button variant="link" className="mt-2">Ver Plantilla Origen</Button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="mt-0 space-y-8 flex flex-col h-[650px] animate-in fade-in duration-500">
            {/* Header / Actions */}
            <div className="flex items-center justify-between bg-muted/10 p-4 rounded-2xl border border-dashed border-primary/20">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
                        <Layers className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-primary">
                            Matriz de Variantes ({variants.length})
                        </h3>
                        {selectedVariantIds.length > 0 ? (
                            <span className="text-[10px] font-black bg-primary text-primary-foreground px-2 py-0.5 rounded-full animate-pulse">
                                {selectedVariantIds.length} SELECCIONADAS
                            </span>
                        ) : (
                            <p className="text-[10px] text-muted-foreground font-bold italic">Gestione combinaciones de atributos y stock individual.</p>
                        )}
                    </div>
                </div>
 
                <div className="flex items-center gap-2">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={fetchVariants}
                        className="h-9 px-4 text-[10px] font-black uppercase tracking-tighter hover:bg-primary/5 text-muted-foreground"
                    >
                        <RefreshCw className="h-3.5 w-3.5 mr-2 opacity-60" /> Sincronizar
                    </Button>
                    
                    <Button 
                        size="sm" 
                        className="h-9 px-5 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
                        disabled={availableAttributes.length === 0}
                        onClick={() => setIsSheetOpen(true)}
                    >
                        <Wand2 className="h-3.5 w-3.5 mr-2" />
                        {isPendingGeneration ? "Editar Gen." : "Generador"}
                    </Button>
 
                    <BaseModal 
                        open={isSheetOpen} 
                        onOpenChange={setIsSheetOpen}
                        size="md"
                        title={
                            <div className="flex items-center gap-4 text-2xl font-black uppercase tracking-tighter">
                                <div className="p-3 bg-primary/10 rounded-2xl border-2 border-primary/20">
                                    <Wand2 className="h-8 w-8 text-primary" />
                                </div>
                                Generar Combinaciones
                            </div>
                        }
                    >
                        <div className="flex flex-col h-full p-2">
                            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                <div className="flex-1 overflow-y-auto pr-4 space-y-10 scrollbar-thin">
                                    {availableAttributes.map(attr => (
                                        <div key={attr.id} className="space-y-6">
                                            <FormSection title={attr.name} icon={Layers} />
                                            <div className="grid grid-cols-2 gap-3">
                                                {attr.values.map(val => {
                                                    const isSelected = selectedValues[attr.id]?.includes(val.id) || false;
                                                    return (
                                                        <div 
                                                            key={val.id} 
                                                            className={cn(
                                                                "flex items-center space-x-3 p-3.5 rounded-xl border transition-all cursor-pointer group",
                                                                isSelected 
                                                                    ? "bg-primary/5 border-primary/40 shadow-sm" 
                                                                    : "bg-background hover:border-primary/30 grayscale hover:grayscale-0 opacity-60 hover:opacity-100"
                                                            )}
                                                            onClick={() => toggleValue(attr.id, val.id)}
                                                        >
                                                            <Checkbox
                                                                id={`val-${val.id}`}
                                                                checked={isSelected}
                                                                onCheckedChange={() => toggleValue(attr.id, val.id)}
                                                                className="h-5 w-5 rounded-lg border-primary/20"
                                                            />
                                                            <label htmlFor={`val-${val.id}`} className="text-[11px] font-black uppercase tracking-tight cursor-pointer truncate">
                                                                {val.value}
                                                            </label>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
 
                                <div className="shrink-0 mt-10 pt-8 border-t border-dashed">
                                    <Button
                                        className="w-full h-16 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all hover:scale-[1.01] active:scale-[0.98]"
                                        onClick={handleGenerateVariants}
                                        disabled={isGenerating || availableAttributes.length === 0}
                                    >
                                        {isGenerating ? "Procesando..." : !initialData?.id ? "Fijar Configuración" : "Generar Matriz"}
                                    </Button>
 
                                    {!initialData?.id && (
                                        <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                                            <p className="text-[9px] text-amber-600 text-center font-black uppercase tracking-tighter italic">
                                                * Las variantes se crearán automáticamente al confirmar la ficha principal.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </BaseModal>
                </div>
            </div>

            {/* Split View Layout */}
            <div className="flex-1 flex gap-4 overflow-hidden relative">
                
                {/* Left: Master Table */}
                <div className={cn(
                    "flex-1 rounded-md border bg-card/50 overflow-hidden flex flex-col transition-all duration-300",
                    (activeEditVariant || selectedVariantIds.length > 0) ? "md:w-3/5 lg:w-2/3" : "w-full"
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
                                    <TableHead className="font-bold">Código</TableHead>
                                    <TableHead className="font-bold">Atributos</TableHead>
                                    <TableHead className="font-bold text-right">Precio</TableHead>
                                    <TableHead className="font-bold text-center">Disp.</TableHead>
                                    <TableHead className="font-bold text-center">BOM</TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {variants.map(v => {
                                    const isSelected = selectedVariantIds.includes(v.id);
                                    const isActive = activeEditVariantId === v.id;
                                    
                                    return (
                                        <TableRow 
                                            key={v.id} 
                                            className={cn(
                                                "cursor-pointer group transition-colors",
                                                isActive ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50",
                                                isSelected && "bg-primary/10/50 hover:bg-primary/10/80"
                                            )}
                                            onClick={() => handleRowClick(v.id)}
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
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-xs truncate max-w-[150px]" title={v.variant_display_name || v.name}>{v.variant_display_name || v.name}</span>
                                                    <div className="flex gap-1 flex-wrap mt-1">
                                                        {v.attribute_values_data?.slice(0, 2).map((av: ProductAttributeValue, valIndex: number) => (
                                                            <span key={valIndex} className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border bg-muted/50 border-border/50 text-muted-foreground">
                                                                {av.value}
                                                            </span>
                                                        ))}
                                                        {(v.attribute_values_data?.length ?? 0) > 2 && (
                                                            <span className="text-[10px] text-muted-foreground ml-1">+{(v.attribute_values_data?.length ?? 0) - 2}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-xs">
                                                ${Number(v.sale_price).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {v.has_active_bom ? (
                                                    <span className={cn(
                                                        "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border",
                                                        (v.current_stock ?? 0) > 0 ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"
                                                    )}>
                                                        STOCK: {v.current_stock || 0}
                                                    </span>
                                                ) : (
                                                    (v.product_type === 'MANUFACTURABLE' || v.requires_advanced_manufacturing) ? (
                                                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border bg-primary/10 text-primary border-primary/20">
                                                            Disp
                                                        </span>
                                                    ) : (
                                                        <Badge className={cn("font-bold px-1.5 py-0 text-[10px] border", (v.current_stock ?? 0) > 0 ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20")}>
                                                            {v.current_stock}
                                                        </Badge>
                                                    )
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                 {v.has_active_bom ? (
                                                      <span className="text-[9px] text-emerald-600 font-black bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20 uppercase tracking-tighter">BOM ACTIVA</span>
                                                 ) : (
                                                      v.mfg_auto_finalize ? (
                                                          <span className="text-[9px] text-destructive font-black bg-destructive/10 px-2 py-1 rounded-full border border-destructive/20 uppercase tracking-tighter animate-pulse">SIN RECETA</span>
                                                      ) : (
                                                          <span className="text-[9px] text-muted-foreground/40 font-bold">-</span>
                                                      )
                                                 )}
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-primary hover:bg-primary/10 hidden lg:flex"
                                                        onClick={(e) => { e.stopPropagation(); onEditVariant?.(v); }}
                                                        title="Edición Avanzada (Modal Completo)"
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                        onClick={(e) => handleDeleteVariant(v, e)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
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
                                                    <span className="text-xs mt-1 block">Utilice el botón &quot;Generador&quot; arriba a la derecha.</span>
                                                </>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Right: Detail View (Quick Edit or Bulk Edit) */}
                {(activeEditVariant || selectedVariantIds.length > 0) && (
                    <div className="w-full md:w-2/5 lg:w-1/3 flex-shrink-0 h-full">
                        {selectedVariantIds.length > 0 ? (
                            <BulkVariantEditForm 
                                selectedVariants={selectedVariantsList}
                                availableVariants={variants}
                                onSaved={(updatedVariants: Product[]) => {
                                    // Update local variants UI
                                    setVariants(prev => prev.map(v => {
                                        const matching = updatedVariants.find((upd: Product) => upd.id === v.id);
                                        return matching || v;
                                    }));
                                    
                                    // Add to form payload for main submit
                                    const currentUpdates = form.getValues("variant_updates") || [];
                                    let newUpdates = [...currentUpdates];
                                    updatedVariants.forEach((uv: Product) => {
                                        newUpdates = [...newUpdates.filter((u: Product) => u.id !== uv.id), uv];
                                    });
                                    form.setValue("variant_updates", newUpdates, { shouldDirty: true });
                                    
                                    setSelectedVariantIds([]);
                                }}
                                onCancel={() => setSelectedVariantIds([])}
                            />
                        ) : activeEditVariant ? (
                            <VariantQuickEditForm 
                                variant={activeEditVariant} 
                                onSaved={(updatedVariant: Product) => {
                                    // Update local variants UI
                                    setVariants(prev => prev.map(v => v.id === updatedVariant.id ? updatedVariant : v));
                                    
                                    // Add to form payload for main submit
                                    const currentUpdates = form.getValues("variant_updates") || [];
                                    const newUpdates = [...currentUpdates.filter((u: Product) => u.id !== updatedVariant.id), updatedVariant];
                                    form.setValue("variant_updates", newUpdates, { shouldDirty: true });
                                }}
                                onCancel={() => setActiveEditVariantId(null)}
                                onTabChange={(tab: string) => onTabChange?.(tab)}
                            />
                        ) : null}
                    </div>
                )}
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
                title="Eliminar Variante"
                description={`¿Está seguro de eliminar la variante ${variantToDelete?.variant_display_name || variantToDelete?.name || ''}?`}
                variant="destructive"
            />
        </div>
    )
}
