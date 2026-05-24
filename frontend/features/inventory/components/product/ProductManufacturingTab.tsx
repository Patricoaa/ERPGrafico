"use client"

import { UoM, Product } from "@/types/entities"
import { LabeledContainer, FormSection, FormTabsContent, LabeledSwitch, LabeledSeparator, ActionConfirmModal } from "@/components/shared"
import { FormField } from "@/components/ui/form"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Package, Layers, Clock, Settings2, Info, Monitor, Printer, Scissors, Box, Trash2 } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { ProductInitialData } from "@/types/forms"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { FormLineItemsTable } from "@/components/shared/FormLineItemsTable"
import { useBOMs } from "@/features/production/hooks/useBOMs"
import { BOMFormModal } from "@/features/production/components/BOMFormModal"
import { BOM } from "@/features/production/types"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Edit } from "lucide-react"

interface ProductManufacturingTabProps {
    form: UseFormReturn<ProductFormValues>
    initialData?: ProductInitialData
    products: Product[]
    uoms: UoM[]
    variantMode?: boolean
}

export function ProductManufacturingTab({ form, products, uoms, variantMode = false, initialData }: ProductManufacturingTabProps) {
    const { boms, isBOMsLoading, refetch, deleteBom, toggleActive } = useBOMs({ product_id: initialData?.id })
    const [isBomModalOpen, setIsBomModalOpen] = useState(false)
    const [bomToEdit, setBomToEdit] = useState<BOM | undefined>(undefined)
    const [confirmDeleteBomId, setConfirmDeleteBomId] = useState<number | undefined>(undefined)

    const hasBom = form.watch("has_bom")
    const isEditing = !!initialData
    const requiresAdvancedmfg = form.watch("requires_advanced_manufacturing")
    const isExpress = form.watch("mfg_auto_finalize")
    const hasVariants = form.watch("has_variants")
    const productionMode = requiresAdvancedmfg ? "advanced" : (isExpress ? "express" : "simple")

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="space-y-4">
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
                                        track_inventory: true,
                                    }
                                        : value === "express" ? {
                                            has_bom: true,
                                            requires_advanced_manufacturing: false,
                                            mfg_auto_finalize: true,
                                            track_inventory: false,
                                        }
                                            : {
                                                has_bom: true,
                                                requires_advanced_manufacturing: true,
                                                mfg_auto_finalize: false,
                                                track_inventory: false,
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
                                    <span className="text-[9px] text-muted-foreground font-medium leading-tight text-center">Manual / Lote</span>
                                </TabsTrigger>
                                <TabsTrigger
                                    type="button"
                                    value="express"
                                    className="flex flex-col gap-1 py-1 h-full data-[state=active]:bg-primary/5 data-[state=active]:border-primary/50 data-[state=active]:ring-1 data-[state=active]:ring-primary/10 border-2 border-transparent transition-all duration-300"
                                >
                                    <Clock className="h-4 w-4" />
                                    <span className="text-[10px] font-black uppercase tracking-tighter">Express</span>
                                    <span className="text-[9px] text-muted-foreground font-medium leading-tight text-center">Auto-cierre</span>
                                </TabsTrigger>
                                <TabsTrigger
                                    type="button"
                                    value="advanced"
                                    className="flex flex-col gap-1 py-1 h-full data-[state=active]:bg-primary/5 data-[state=active]:border-primary/50 data-[state=active]:ring-1 data-[state=active]:ring-primary/10 border-2 border-transparent transition-all duration-300"
                                >
                                    <Layers className="h-4 w-4" />
                                    <span className="text-[10px] font-black uppercase tracking-tighter">Avanzado</span>
                                    <span className="text-[9px] text-muted-foreground font-medium leading-tight text-center">Wizard Etapas</span>
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

            {hasBom && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-600">
                    <FormSection title="Lista de materiales (LdM)" icon={Layers} />

                    {/* Contextual note for templates with variants */}
                    {hasVariants && (
                        <div className="flex items-start gap-3 p-3 rounded-md bg-info/5 border border-info/20 mb-4">
                            <Info className="h-3.5 w-3.5 text-info mt-0.5 shrink-0" />
                            <p className="text-[10px] text-info/80 font-medium leading-relaxed">
                                Esta receta aplica al <strong>producto plantilla</strong>.
                                Para gestionar las recetas de las variantes, use <strong>"Clonar BOM"</strong> en el Tab Variantes.
                            </p>
                        </div>
                    )}

                    {!initialData?.id ? (
                        <div className="p-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-border/50 rounded-md bg-card">
                            <Package className="h-10 w-10 text-muted-foreground/30 mb-3" />
                            <h3 className="text-sm font-semibold mb-1">Producto no guardado</h3>
                            <p className="text-xs text-muted-foreground max-w-sm">
                                Debe guardar el producto primero antes de poder gestionar las Listas de Materiales.
                            </p>
                        </div>
                    ) : (
                        <FormLineItemsTable

                            onAdd={() => {
                                setBomToEdit(undefined)
                                setIsBomModalOpen(true)
                            }}
                            addButtonText="Nueva Lista de Materiales"
                            columns={[
                                { header: "Nombre de la Receta", width: "w-1/2", align: "left" },
                                { header: "Componentes", width: "w-1/4", align: "center" },
                                { header: "Activa", width: "w-24", align: "center" },
                                { header: "", width: "w-16" },
                            ]}
                        >
                            <TableBody>
                                {isBOMsLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-xs italic">
                                            Cargando recetas...
                                        </TableCell>
                                    </TableRow>
                                ) : boms.map((bom) => (
                                    <TableRow key={bom.id} className="hover:bg-primary/5 transition-colors">
                                        <TableCell className="p-3 align-middle font-medium text-xs">
                                            {bom.name}
                                        </TableCell>
                                        <TableCell className="p-3 align-middle text-center">
                                            <Badge variant="outline" className="text-[10px] font-mono">
                                                {bom.lines?.length || 0} items
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="p-3 align-middle text-center">
                                            <div className="flex justify-center">
                                                <Switch
                                                    checked={bom.active}
                                                    disabled={bom.active}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            toggleActive(bom.id!)
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-3 align-middle text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                    onClick={() => {
                                                        setBomToEdit(bom)
                                                        setIsBomModalOpen(true)
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => setConfirmDeleteBomId(bom.id!)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {!isBOMsLoading && boms.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-xs italic">
                                            No hay recetas configuradas. Haga clic en "Nueva Lista de Materiales".
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </FormLineItemsTable>
                    )}
                </div>
            )}

            {isBomModalOpen && (
                <BOMFormModal
                    open={isBomModalOpen}
                    onOpenChange={setIsBomModalOpen}
                    product={initialData as any}
                    bomToEdit={bomToEdit}
                    onSuccess={() => refetch()}
                />
            )}

            <ActionConfirmModal
                open={confirmDeleteBomId !== undefined}
                onOpenChange={(open) => { if (!open) setConfirmDeleteBomId(undefined) }}
                onConfirm={async () => {
                    if (confirmDeleteBomId !== undefined) {
                        await deleteBom(confirmDeleteBomId)
                    }
                }}
                title="Eliminar Receta"
                description="¿Eliminar esta receta? Esta acción no se puede deshacer."
                variant="destructive"
                confirmText="Eliminar"
            />
        </div>
    )
}
