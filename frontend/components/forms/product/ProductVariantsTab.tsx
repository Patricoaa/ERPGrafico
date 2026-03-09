import React, { useEffect, useState, useMemo } from "react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Plus, ListFilter, Trash2, RefreshCw, Layers, Pencil, AlertCircle, Wand2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import api from "@/lib/api"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"

import { VariantQuickEditForm } from "./VariantQuickEditForm"
import { BulkVariantEditForm } from "./BulkVariantEditForm"

interface ProductVariantsTabProps {
    form: UseFormReturn<ProductFormValues>
    initialData?: any
    onEditVariant?: (variant: any) => void
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
    const [variants, setVariants] = useState<any[]>([])
    const [isSheetOpen, setIsSheetOpen] = useState(false)

    // Master-Detail State
    const [selectedVariantIds, setSelectedVariantIds] = useState<number[]>([])
    const [activeEditVariantId, setActiveEditVariantId] = useState<number | null>(null)

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

            const enriched = attrs.map((a: any) => ({
                ...a,
                values: vals.filter((v: any) => v.attribute === a.id)
            }))
            setAvailableAttributes(enriched)
        } catch (error) {
            console.error("Failed to fetch attributes", error)
        }
    }

    const fetchVariants = async () => {
        try {
            const res = await api.get(`/inventory/products/?parent_template=${initialData.id}&show_technical_variants=true`)
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

    const handleDeleteVariant = async (variant: any, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`¿Está seguro de eliminar la variante ${variant.variant_display_name || variant.name}?`)) {
            return
        }

        try {
            await api.delete(`/inventory/products/${variant.id}/`)
            toast.success("Variante eliminada exitosamente")
            if (activeEditVariantId === variant.id) setActiveEditVariantId(null)
            setSelectedVariantIds(prev => prev.filter(id => id !== variant.id))
            fetchVariants()
        } catch (error) {
            console.error("Failed to delete variant", error)
            toast.error("Error al eliminar variante")
        }
    }

    const handleGenerateVariants = async () => {
        if (!initialData?.id) {
            toast.error("Guarde el producto base antes de generar variantes")
            return
        }

        const attrIds = Object.keys(selectedValues).filter(id => selectedValues[Number(id)].length > 0)
        if (attrIds.length === 0) {
            toast.error("Seleccione al menos un valor de atributo")
            return
        }

        setIsGenerating(true)
        try {
            await api.post(`/inventory/products/${initialData.id}/generate_variants/`, {
                selection: Object.entries(selectedValues).map(([id, vals]) => ({
                    attribute: Number(id),
                    values: vals
                }))
            })

            toast.success("Variantes generadas con éxito")
            fetchVariants()
            setSelectedValues({})
            setIsSheetOpen(false)
        } catch (error: any) {
            toast.error("Error al generar variantes", {
                description: error.response?.data?.error || "Error desconocido"
            })
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

    const toggleVariantSelect = (id: number, e: React.MouseEvent | React.ChangeEvent) => {
        e.stopPropagation()
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
            <TabsContent value="variants" className="mt-0 p-6 text-center space-y-4">
                <div className="flex flex-col items-center justify-center py-12 bg-muted/20 rounded-3xl border-2 border-dashed">
                    <Layers className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-bold">Este producto es una variante</h3>
                    <p className="text-sm text-muted-foreground">
                        Las variantes se gestionan desde el producto plantilla.
                    </p>
                    {initialData?.parent_template && (
                        <Button variant="link" className="mt-2">Ver Plantilla Origen</Button>
                    )}
                </div>
            </TabsContent>
        )
    }

    return (
        <TabsContent value="variants" className="mt-0 space-y-6 flex flex-col h-[600px]">
            
            {/* Header / Actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Layers className="h-5 w-5 text-primary" />
                        Variantes Configuradas ({variants.length})
                    </h3>
                    {selectedVariantIds.length > 0 && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                            {selectedVariantIds.length} seleccionadas
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={fetchVariants}
                        className="text-xs"
                    >
                        <RefreshCw className="h-3.5 w-3.5 mr-2" /> Actualizar
                    </Button>
                    
                    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                        <SheetTrigger asChild>
                            <Button 
                                size="sm" 
                                className="text-xs font-bold"
                                disabled={!initialData || (form.watch("has_variants") && !initialData.has_variants)}
                            >
                                <Wand2 className="h-4 w-4 mr-2" />
                                Generador
                            </Button>
                        </SheetTrigger>
                        <SheetContent className="w-[400px] sm:w-[540px] border-l-0 shadow-2xl flex flex-col p-6 sm:p-8">
                            <SheetHeader className="mb-6 shrink-0">
                                <SheetTitle className="flex items-center gap-3 text-xl font-bold">
                                    <div className="p-2.5 rounded-xl bg-violet-100/80">
                                        <Wand2 className="h-6 w-6 text-violet-700" />
                                    </div>
                                    GENERAR COMBINACIONES
                                </SheetTitle>
                            </SheetHeader>
                            
                            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                <div className="flex-1 overflow-y-auto pr-3 space-y-6 scrollbar-thin">
                                    {availableAttributes.map(attr => (
                                        <div key={attr.id} className="space-y-4 p-5 border rounded-2xl bg-white shadow-sm">
                                            <Label className={cn(FORM_STYLES.label, "font-bold text-sm text-foreground/80 tracking-wide uppercase")}>{attr.name}</Label>
                                            <div className="grid grid-cols-2 gap-3">
                                                {attr.values.map(val => (
                                                    <div key={val.id} className="flex items-center space-x-3 p-3 rounded-xl border bg-background hover:bg-muted/30 hover:border-primary/50 transition-all">
                                                        <Checkbox
                                                            id={`val-${val.id}`}
                                                            checked={selectedValues[attr.id]?.includes(val.id) || false}
                                                            onCheckedChange={() => toggleValue(attr.id, val.id)}
                                                            className="h-5 w-5 rounded data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-muted-foreground/30"
                                                        />
                                                        <label htmlFor={`val-${val.id}`} className="text-sm cursor-pointer select-none truncate flex-1 font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                            {val.value}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="shrink-0 mt-8 pt-6 border-t">
                                    <Button
                                        className="w-full h-14 rounded-xl font-bold text-md shadow-md bg-violet-700 hover:bg-violet-800 text-white transition-colors"
                                        onClick={handleGenerateVariants}
                                        disabled={isGenerating || availableAttributes.length === 0}
                                    >
                                        {isGenerating ? "Generando Combinaciones..." : "Crear Variantes"}
                                    </Button>

                                    {!initialData && (
                                        <p className="text-[11px] text-destructive text-center font-medium italic mt-3">
                                            * Debe guardar el producto base antes de crear variantes
                                        </p>
                                    )}
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>

            {/* Split View Layout */}
            <div className="flex-1 flex gap-4 overflow-hidden relative">
                
                {/* Left: Master Table */}
                <div className={cn(
                    "flex-1 rounded-2xl border bg-card/50 overflow-hidden flex flex-col transition-all duration-300",
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
                                                isSelected && "bg-blue-50/50 hover:bg-blue-50/80"
                                            )}
                                            onClick={() => handleRowClick(v.id)}
                                        >
                                            <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox 
                                                    checked={isSelected}
                                                    onCheckedChange={(checked) => toggleVariantSelect(v.id, checked as unknown as React.ChangeEvent)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </TableCell>
                                            <TableCell className="font-mono text-[11px]">{v.internal_code || v.code}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-xs truncate max-w-[150px]" title={v.variant_display_name || v.name}>{v.variant_display_name || v.name}</span>
                                                    <div className="flex gap-1 flex-wrap mt-1">
                                                        {v.attribute_values_data?.slice(0, 2).map((av: any) => (
                                                            <Badge key={av.id} variant="secondary" className="text-[9px] px-1 py-0 bg-background/80">
                                                                {av.value}
                                                            </Badge>
                                                        ))}
                                                        {v.attribute_values_data?.length > 2 && (
                                                            <span className="text-[10px] text-muted-foreground ml-1">+{v.attribute_values_data.length - 2}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-xs">
                                                ${Number(v.sale_price).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {v.has_active_bom ? (
                                                    <Badge variant={v.current_stock > 0 ? "success" : "secondary"} className="font-bold px-1.5 py-0 text-[10px]">
                                                        {v.current_stock}
                                                    </Badge>
                                                ) : (
                                                    (v.product_type === 'MANUFACTURABLE' || v.requires_advanced_manufacturing) ? (
                                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-1.5 py-0 text-[10px]">
                                                            Disp
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant={v.current_stock > 0 ? "success" : "destructive"} className="font-bold px-1.5 py-0 text-[10px]">
                                                            {v.current_stock}
                                                        </Badge>
                                                    )
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                 {v.has_active_bom ? (
                                                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">✓ BOM</span>
                                                 ) : (
                                                      v.mfg_auto_finalize ? (
                                                          <span className="text-[10px] text-destructive font-bold bg-destructive/10 px-1.5 py-0.5 rounded border border-destructive/20">FALTA</span>
                                                      ) : (
                                                          <span className="text-[10px] text-muted-foreground">-</span>
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
                                            No se han generado variantes para este producto.
                                            <br />
                                            <span className="text-xs mt-1 block">Utilice el botón "Generador" arriba a la derecha.</span>
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
                                onSaved={(updatedVariants: any[]) => {
                                    // Update local variants UI
                                    setVariants(prev => prev.map(v => {
                                        const matching = updatedVariants.find((upd: any) => upd.id === v.id);
                                        return matching || v;
                                    }));
                                    
                                    // Add to form payload for main submit
                                    const currentUpdates = form.getValues("variant_updates") || [];
                                    let newUpdates = [...currentUpdates];
                                    updatedVariants.forEach((uv: any) => {
                                        newUpdates = [...newUpdates.filter((u: any) => u.id !== uv.id), uv];
                                    });
                                    form.setValue("variant_updates", newUpdates, { shouldDirty: true });
                                    
                                    setSelectedVariantIds([]);
                                }}
                                onCancel={() => setSelectedVariantIds([])}
                            />
                        ) : activeEditVariant ? (
                            <VariantQuickEditForm 
                                variant={activeEditVariant} 
                                onSaved={(updatedVariant: any) => {
                                    // Update local variants UI
                                    setVariants(prev => prev.map(v => v.id === updatedVariant.id ? updatedVariant : v));
                                    
                                    // Add to form payload for main submit
                                    const currentUpdates = form.getValues("variant_updates") || [];
                                    const newUpdates = [...currentUpdates.filter((u: any) => u.id !== updatedVariant.id), updatedVariant];
                                    form.setValue("variant_updates", newUpdates, { shouldDirty: true });
                                }}
                                onCancel={() => setActiveEditVariantId(null)}
                                onTabChange={(tab: string) => onTabChange?.(tab)}
                            />
                        ) : null}
                    </div>
                )}
            </div>
            
        </TabsContent>
    )
}
