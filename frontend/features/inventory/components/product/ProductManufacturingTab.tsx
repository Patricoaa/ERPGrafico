"use client"

import { UoM, Product } from "@/types/entities"
import { LabeledInput, LabeledContainer, FormSection, FormTabsContent, LabeledSwitch, LabeledSeparator } from "@/components/shared"
import { FormField } from "@/components/ui/form"
import { EmptyState } from "@/components/shared/EmptyState"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Package, Plus, Trash2, Layers, Check, ChevronUp, ChevronDown, X, Clock, Settings2, Search, Monitor, Printer, Scissors, Box } from "lucide-react"
import { UseFormReturn, useFieldArray } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { ProductInitialData } from "@/types/forms"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import { useState } from "react"
import { BOMManager } from "@/features/production/components/BOMManager"
import { ProductSelector, UoMSelector } from "@/components/selectors"

interface ProductManufacturingTabProps {
    form: UseFormReturn<ProductFormValues>
    initialData?: ProductInitialData
    products: Product[]
    uoms: UoM[]
    variantMode?: boolean
}

export function ProductManufacturingTab({ form, products, uoms, variantMode = false, initialData }: ProductManufacturingTabProps) {
    const { fields: bomFields, append: appendBom, remove: removeBom } = useFieldArray({
        control: form.control,
        name: "boms"
    })

    const hasBom = form.watch("has_bom")
    const isEditing = !!initialData
    const requiresAdvancedmfg = form.watch("requires_advanced_manufacturing")
    const isExpress = form.watch("mfg_auto_finalize")
    const hasVariants = form.watch("has_variants")
    const productionMode = requiresAdvancedmfg ? "advanced" : (isExpress ? "express" : "simple")

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                {!variantMode && (
                    <div className="md:col-span-5 space-y-6">
                        <FormSection title="Ajustes de Producción" icon={Settings2} />

                        <div className="space-y-6">
                            <LabeledContainer
                                label="Modo de Producción"
                            >
                                <Tabs
                                    value={productionMode}
                                    onValueChange={(value) => {
                                        if (value === productionMode) return;
                                        
                                        const patch: Record<string, boolean> =
                                            value === "simple" ? {
                                                requires_advanced_manufacturing: false,
                                                mfg_auto_finalize: false,
                                            }
                                                : value === "express" ? {
                                                    has_bom: true,
                                                    requires_advanced_manufacturing: false,
                                                    mfg_auto_finalize: true,
                                                }
                                                    : {
                                                        has_bom: true,
                                                        requires_advanced_manufacturing: true,
                                                        mfg_auto_finalize: false,
                                                    };

                                        Object.entries(patch).forEach(([k, v]) => {
                                            if (form.getValues(k as any) !== v) {
                                                form.setValue(k as any, v, { shouldDirty: true });
                                            }
                                        });
                                    }}
                                    className="w-full"
                                >
                                    <TabsList className="grid w-full grid-cols-3 h-20 bg-transparent p-1 border-none shadow-none">
                                        <TabsTrigger 
                                            type="button"
                                            value="simple" 
                                            className="flex flex-col gap-1 py-1 h-full data-[state=active]:bg-primary/5 data-[state=active]:border-primary/50 data-[state=active]:ring-1 data-[state=active]:ring-primary/10 border-2 border-transparent transition-all duration-300"
                                        >
                                            <Package className="h-4 w-4" />
                                            <span className="text-[10px] font-black uppercase tracking-tighter">Simple</span>
                                            <span className="text-[8px] text-muted-foreground font-medium leading-tight text-center">Manual / Lote</span>
                                        </TabsTrigger>
                                        <TabsTrigger 
                                            type="button"
                                            value="express" 
                                            className="flex flex-col gap-1 py-1 h-full data-[state=active]:bg-primary/5 data-[state=active]:border-primary/50 data-[state=active]:ring-1 data-[state=active]:ring-primary/10 border-2 border-transparent transition-all duration-300"
                                        >
                                            <Clock className="h-4 w-4" />
                                            <span className="text-[10px] font-black uppercase tracking-tighter">Express</span>
                                            <span className="text-[8px] text-muted-foreground font-medium leading-tight text-center">Auto-cierre</span>
                                        </TabsTrigger>
                                        <TabsTrigger 
                                            type="button"
                                            value="advanced" 
                                            className="flex flex-col gap-1 py-1 h-full data-[state=active]:bg-primary/5 data-[state=active]:border-primary/50 data-[state=active]:ring-1 data-[state=active]:ring-primary/10 border-2 border-transparent transition-all duration-300"
                                        >
                                            <Layers className="h-4 w-4" />
                                            <span className="text-[10px] font-black uppercase tracking-tighter">Avanzado</span>
                                            <span className="text-[8px] text-muted-foreground font-medium leading-tight text-center">Wizard Etapas</span>
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </LabeledContainer>

                            <div className="space-y-4">
                                <FormField<ProductFormValues>
                                    control={form.control}
                                    name="has_bom"
                                    render={({ field }) => (
                                        <LabeledSwitch
                                            label="Lista de Materiales"
                                            description={isExpress && !hasVariants ? "Requerido para modo Express." : "Habilitar receta de fabricación."}
                                            checked={field.value}
                                            onCheckedChange={(val) => {
                                                form.setValue("has_bom", val, { shouldDirty: true, shouldValidate: false })
                                            }}
                                            disabled={isExpress && !hasVariants}
                                            icon={<Package className="h-4 w-4" />}
                                        />
                                    )}
                                />

                                <FormField<ProductFormValues>
                                    control={form.control}
                                    name="has_variants"
                                    render={({ field }) => (
                                        <LabeledSwitch
                                            label="Variantes"
                                            description="Múltiples versiones del mismo producto."
                                            checked={field.value}
                                            onCheckedChange={(val) => {
                                                form.setValue("has_variants", val, { shouldDirty: true, shouldValidate: false })
                                            }}
                                            icon={<Layers className="h-4 w-4" />}
                                            color="warning"
                                        />
                                    )}
                                />
                            </div>

                            <div
                                className={cn(
                                    "space-y-4 animate-in fade-in slide-in-from-top-2 duration-300",
                                    !requiresAdvancedmfg && "hidden"
                                )}
                            >
                                <LabeledSeparator
                                    label="Etapas de Flujo Requeridas"
                                    icon={<Layers className="h-3 w-3" />}
                                />

                                <div className="space-y-2">
                                    {[
                                        { name: "mfg_enable_prepress", label: "Pre-Impresión", icon: Monitor },
                                        { name: "mfg_enable_press", label: "Impresión", icon: Printer },
                                        { name: "mfg_enable_postpress", label: "Post-Impresión", icon: Scissors }
                                    ].map((stage) => (
                                        <FormField<ProductFormValues>
                                            key={stage.name}
                                            control={form.control}
                                            name={stage.name as any}
                                            render={({ field }) => (
                                                <LabeledSwitch
                                                    label={stage.label}
                                                    checked={field.value}
                                                    onCheckedChange={(val) => {
                                                        form.setValue(stage.name as any, val, { shouldDirty: true, shouldValidate: false })
                                                    }}
                                                    icon={<stage.icon className="h-4 w-4" />}
                                                />
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className={cn(variantMode ? "md:col-span-12" : "md:col-span-7", "space-y-6")}>
                    {(hasBom || variantMode) && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-600">
                            <FormSection title="Gestión de Recetas (BOM)" icon={Layers} />
                            
                            <div className="space-y-6">
                                {isEditing ? (
                                    <BOMManager
                                        product={initialData as any}
                                        variantMode={variantMode}
                                    />
                                ) : (
                                    <div className="py-20 border-4 border-dashed rounded-3xl flex flex-col items-center justify-center text-center px-10 bg-muted/5 group hover:border-primary/20 transition-all duration-500">
                                        <div className="p-6 rounded-2xl bg-background border shadow-sm mb-4 group-hover:scale-105 transition-transform duration-500">
                                            <Box className="h-10 w-10 text-primary opacity-40" />
                                        </div>
                                        <h4 className="font-black uppercase tracking-widest text-muted-foreground/80">Receta no Disponible</h4>
                                        <p className="text-[10px] text-muted-foreground/50 max-w-xs mt-2 font-medium leading-relaxed italic">
                                            Primero debe guardar la información básica del producto para poder configurar su estructura de materiales (BOM).
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
