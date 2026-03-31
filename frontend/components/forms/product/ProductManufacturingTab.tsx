import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Package, Plus, Trash2, Layers, Check, ChevronUp, ChevronDown, X, Clock, Settings2 } from "lucide-react"
import { UseFormReturn, useFieldArray } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { TabsContent, Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { BOMManager } from "@/features/production/components/BOMManager"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { FORM_STYLES } from "@/lib/styles"
import { Label } from "@/components/ui/label"

interface ProductManufacturingTabProps {
    form: UseFormReturn<ProductFormValues>
    initialData?: any
    products: any[]
    uoms: any[]
    variantMode?: boolean
}

export function ProductManufacturingTab({ form, initialData, products, uoms, variantMode = false }: ProductManufacturingTabProps) {
    const { fields: bomFields, append: appendBom, remove: removeBom } = useFieldArray({
        control: form.control,
        name: "boms"
    })

    const hasBom = form.watch("has_bom")
    const isEditing = !!initialData

    return (
        <TabsContent value="manufacturing" className="mt-0 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Left Column: Settings & Workflow - Hidden in variant mode for "direct" BOM access */}
                {!variantMode && (
                    <div className="md:col-span-4 space-y-6">
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 pt-2 pb-2">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                                    <Settings2 className="h-3 w-3" /> Ajustes de Producción
                                </span>
                                <div className="flex-1 h-px bg-border" />
                            </div>

                            <FormField<ProductFormValues>
                                control={form.control}
                                name="mfg_default_delivery_days"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Clock className="h-4 w-4 text-muted-foreground" />
                                            <FormLabel className={FORM_STYLES.label}>Días de Entrega Estándar</FormLabel>
                                        </div>
                                        <FormControl>
                                            <div className="relative">
                                                <Input type="number" {...field} className="font-bold" />
                                                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground uppercase font-black">Días</span>
                                            </div>
                                        </FormControl>
                                        <FormDescription className="text-[10px]">
                                            Tiempo estimado desde la orden hasta la entrega.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="space-y-4 pt-2">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Modo de Producción</Label>
                                <Tabs
                                    value={form.watch("requires_advanced_manufacturing") ? "advanced" : (form.watch("mfg_auto_finalize") ? "express" : "simple")}
                                    onValueChange={(value) => {
                                        if (value === "simple") {
                                            form.setValue("requires_advanced_manufacturing", false);
                                            form.setValue("mfg_auto_finalize", false);
                                            form.setValue("track_inventory", true);
                                            // Simple mode now allows BOM for manual/batch OTs
                                        } else if (value === "express") {
                                            form.setValue("requires_advanced_manufacturing", false);
                                            form.setValue("mfg_auto_finalize", true);
                                            form.setValue("has_bom", true);
                                            form.setValue("track_inventory", false);
                                        } else if (value === "advanced") {
                                            form.setValue("requires_advanced_manufacturing", true);
                                            form.setValue("mfg_auto_finalize", false);
                                            form.setValue("has_bom", true);
                                            form.setValue("track_inventory", false);
                                        }
                                    }}
                                    className="w-full"
                                >
                                    <TabsList className="grid w-full grid-cols-3 h-20 bg-muted/30 p-1">
                                        <TabsTrigger value="simple" className="flex flex-col gap-1 py-1 h-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                            <Package className="h-4 w-4" />
                                            <span className="text-[10px] font-bold">Simple</span>
                                            <span className="text-[8px] text-muted-foreground font-normal leading-tight text-center">Manual / Lote<br />(Contra Stock)</span>
                                        </TabsTrigger>
                                        <TabsTrigger value="express" className="flex flex-col gap-1 py-1 h-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                            <Clock className="h-4 w-4" />
                                            <span className="text-[10px] font-bold">Express</span>
                                            <span className="text-[8px] text-muted-foreground font-normal leading-tight text-center">Auto-cierre<br />(Sobre Pedido)</span>
                                        </TabsTrigger>
                                        <TabsTrigger value="advanced" className="flex flex-col gap-1 py-1 h-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                            <Layers className="h-4 w-4" />
                                            <span className="text-[10px] font-bold">Avanzado</span>
                                            <span className="text-[8px] text-muted-foreground font-normal leading-tight text-center">Wizard Etapas<br />(Sobre Pedido)</span>
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>

                            {/* Traditional Switch for BOM if someone wants custom config */}
                            <FormField<ProductFormValues>
                                control={form.control}
                                name="has_bom"
                                render={({ field }) => {
                                    const isExpress = form.watch("mfg_auto_finalize")
                                    const hasVariants = form.watch("has_variants")
                                    // Express products without variants MUST have BOM (enforced by backend)
                                    const shouldDisable = isExpress && !hasVariants

                                    return (
                                        <FormItem className={cn("flex items-center justify-between p-4 rounded-xl border bg-background/50", FORM_STYLES.card)}>
                                            <div className="space-y-0.5">
                                                <FormLabel className={FORM_STYLES.label}>Posee Lista de Materiales</FormLabel>
                                                <FormDescription className="text-[10px]">
                                                    {shouldDisable
                                                        ? "Los productos Express requieren Lista de Materiales obligatoria."
                                                        : "Detección automática por modo seleccionado."}
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    disabled={shouldDisable}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )
                                }}
                            />

                            {/* Variants toggle moved here as per user request */}
                            <FormField<ProductFormValues>
                                control={form.control}
                                name="has_variants"
                                render={({ field }) => (
                                    !variantMode ? (
                                        <FormItem className={cn("flex items-center justify-between p-4 rounded-xl border bg-background/50", FORM_STYLES.card)}>
                                            <div className="space-y-0.5">
                                                <FormLabel className={FORM_STYLES.label}>Posee Variantes</FormLabel>
                                                <FormDescription className="text-[10px]">
                                                    Permite generar múltiples versiones de este producto.
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={(val) => {
                                                        field.onChange(val)
                                                        // Removed auto-switch to express mode to allow Simple + Variants
                                                    }}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    ) : <></>
                                )}
                            />

                            {form.watch("requires_advanced_manufacturing") && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Etapas del Flujo</h4>

                                        <FormField<ProductFormValues>
                                            control={form.control}
                                            name="mfg_enable_prepress"
                                            render={({ field }) => (
                                                <FormItem className="flex items-center justify-between p-3 rounded-lg border bg-background/30">
                                                    <FormLabel className="text-xs font-medium">Pre-Impresión</FormLabel>
                                                    <FormControl>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        {form.watch("mfg_enable_prepress") && (
                                            <div className="ml-4 space-y-2 pl-4 border-l-2 border-primary/20">
                                                <FormField<ProductFormValues>
                                                    control={form.control}
                                                    name="mfg_prepress_design"
                                                    render={({ field }) => (
                                                        <FormItem className="flex items-center justify-between">
                                                            <FormLabel className="text-[11px] font-normal">Diseño Requerido</FormLabel>
                                                            <FormControl>
                                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField<ProductFormValues>
                                                    control={form.control}
                                                    name="mfg_prepress_folio"
                                                    render={({ field }) => (
                                                        <FormItem className="flex items-center justify-between">
                                                            <FormLabel className="text-[11px] font-normal">Folio</FormLabel>
                                                            <FormControl>
                                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        )}

                                        <FormField<ProductFormValues>
                                            control={form.control}
                                            name="mfg_enable_press"
                                            render={({ field }) => (
                                                <FormItem className="flex items-center justify-between p-3 rounded-lg border bg-background/30">
                                                    <FormLabel className="text-xs font-medium">Impresión</FormLabel>
                                                    <FormControl>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        {form.watch("mfg_enable_press") && (
                                            <div className="ml-4 space-y-2 pl-4 border-l-2 border-primary/20">
                                                <FormField<ProductFormValues>
                                                    control={form.control}
                                                    name="mfg_press_offset"
                                                    render={({ field }) => (
                                                        <FormItem className="flex items-center justify-between">
                                                            <FormLabel className="text-[11px] font-normal">Offset</FormLabel>
                                                            <FormControl>
                                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField<ProductFormValues>
                                                    control={form.control}
                                                    name="mfg_press_digital"
                                                    render={({ field }) => (
                                                        <FormItem className="flex items-center justify-between">
                                                            <FormLabel className="text-[11px] font-normal">Digital</FormLabel>
                                                            <FormControl>
                                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField<ProductFormValues>
                                                    control={form.control}
                                                    name="mfg_press_special"
                                                    render={({ field }) => (
                                                        <FormItem className="flex items-center justify-between">
                                                            <FormLabel className="text-[11px] font-normal">Especial</FormLabel>
                                                            <FormControl>
                                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        )}

                                        <FormField<ProductFormValues>
                                            control={form.control}
                                            name="mfg_enable_postpress"
                                            render={({ field }) => (
                                                <FormItem className="flex items-center justify-between p-3 rounded-lg border bg-background/30">
                                                    <FormLabel className="text-xs font-medium">Post-Impresión</FormLabel>
                                                    <FormControl>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />


                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Right Column: BOM Management - Full width in variant mode */}
                <div className={cn(variantMode ? "md:col-span-12" : "md:col-span-8", "space-y-6")}>
                    {(hasBom || variantMode) && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="flex items-end justify-between mb-4">
                                <div className="flex-1 space-y-1 mr-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                                            <Layers className="h-3 w-3" /> Gestión de Listas de Materiales
                                        </span>
                                        <div className="flex-1 h-px bg-border" />
                                    </div>
                                    <p className="text-xs text-muted-foreground">Define los componentes y procesos necesarios para fabricar este producto.</p>
                                </div>
                            </div>

                            {isEditing ? (
                                <div className={cn("rounded-2xl border", variantMode && "p-0 border-none bg-transparent")}>
                                    <BOMManager 
                                        product={initialData} 
                                        variantMode={variantMode} 
                                        onBomsChange={(loadedBoms) => {
                                            if (!loadedBoms) return;
                                            const mapped = loadedBoms.map(b => ({
                                                id: b.id,
                                                name: b.name || "Lista de Materiales",
                                                active: b.active || false,
                                                lines: b.lines?.length > 0 ? b.lines.map((l: any) => ({
                                                    id: l.id,
                                                    component: l.product_id?.toString() || l.component?.toString() || "1",
                                                    quantity: parseFloat(l.quantity) || 1
                                                })) : [{ component: "dummy", quantity: 1 }]
                                            }));
                                            form.setValue("boms", mapped, { shouldValidate: true });
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {bomFields.map((field, index) => (
                                        <BOMItemField
                                            key={field.id}
                                            form={form}
                                            bomIndex={index}
                                            products={products}
                                            uoms={uoms}
                                            onRemove={() => removeBom(index)}
                                            onSetDefault={() => {
                                                bomFields.forEach((_, i) => form.setValue(`boms.${i}.active`, i === index))
                                            }}
                                        />
                                    ))}
                                    {bomFields.length === 0 && (
                                        <div className="py-12 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-center px-6 bg-muted/5 group hover:bg-muted/10 transition-colors">
                                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                <Layers className="h-8 w-8 text-primary" />
                                            </div>
                                            <h4 className="font-bold text-muted-foreground">Sin recetas definidas</h4>
                                            <p className="text-xs text-muted-foreground/60 max-w-xs mt-1">Haga clic en el botón superior para añadir su primera lista de materiales.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </TabsContent >
    )
}

function BOMItemField({ form, bomIndex, products, uoms, onRemove, onSetDefault }: any) {
    const [isExpanded, setIsExpanded] = useState(false)
    const { fields: lineFields, append, remove } = useFieldArray({
        control: form.control,
        name: `boms.${bomIndex}.lines`
    })

    const isActive = form.watch(`boms.${bomIndex}.active`)

    return (
        <div className={cn(
            "rounded-xl border transition-all duration-200",
            isActive ? "border-primary/50 bg-primary/[0.02]" : "bg-background shadow-sm hover:border-muted-foreground/30"
        )}>
            <div className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 shrink-0">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-8 w-8 rounded-full transition-colors",
                            isActive ? "bg-primary text-white hover:bg-primary/90" : "bg-muted text-muted-foreground hover:bg-muted-foreground/10"
                        )}
                        onClick={onSetDefault}
                    >
                        {isActive ? <Check className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                    </Button>
                    <div className="flex flex-col">
                        <FormField
                            control={form.control}
                            name={`boms.${bomIndex}.name`}
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    placeholder="Nombre de la receta"
                                    className="h-7 text-xs font-bold bg-transparent border-transparent focus-visible:border-primary/30 w-[200px] px-0"
                                />
                            )}
                        />
                        <span className="text-[10px] text-muted-foreground">
                            {lineFields.length} componentes • {isActive ? 'Predeterminada' : 'Respaldo'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                        onClick={onRemove}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mt-4 mb-2">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Componentes de la Receta</h4>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 text-[10px] gap-1 px-2"
                            onClick={() => append({ component: "", quantity: 1, uom: undefined })}
                        >
                            <Plus className="h-3 w-3" /> Añadir
                        </Button>
                    </div>

                    <div className="rounded-lg border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="h-8 hover:bg-transparent">
                                    <TableHead className="text-[10px] h-8 px-2 font-bold">Componente</TableHead>
                                    <TableHead className="text-[10px] h-8 w-[70px] px-2 font-bold text-center">Cant.</TableHead>
                                    <TableHead className="text-[10px] h-8 w-[80px] px-2 font-bold text-center">Unidad</TableHead>
                                    <TableHead className="text-[10px] h-8 w-[32px] px-2"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lineFields.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-4 text-[10px] text-muted-foreground italic">
                                            No hay componentes definidos
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    lineFields.map((field, index) => (
                                        <TableRow key={field.id} className="h-10 hover:bg-muted/5 border-b last:border-0">
                                            <TableCell className="p-1 px-2">
                                                <ProductSelector
                                                    value={form.watch(`boms.${bomIndex}.lines.${index}.component`)}
                                                    onChange={(val: any) => {
                                                        form.setValue(`boms.${bomIndex}.lines.${index}.component`, val)
                                                        const p = products.find((prod: any) => prod.id.toString() === val?.toString());
                                                        if (p && p.uom) {
                                                            form.setValue(`boms.${bomIndex}.lines.${index}.uom`, p.uom.toString());
                                                        }
                                                    }}
                                                    placeholder="Sel. componente"
                                                    customFilter={(product: any) => {
                                                        // No CONSUMABLE - uso interno solamente
                                                        if (product.product_type === 'CONSUMABLE') return false

                                                        // Si es MANUFACTURABLE:
                                                        if (product.product_type === 'MANUFACTURABLE') {
                                                            // Solo mostrar si es express (mfg_auto_finalize: true)
                                                            // Los simples y avanzados no se muestran como componentes según requerimiento
                                                            return !!product.mfg_auto_finalize
                                                        }

                                                        return true
                                                    }} customDisabled={(product: any) => {
                                                        // Deshabilitar STORABLE sin stock
                                                        if (product.product_type === 'STORABLE' && (product.current_stock || 0) <= 0) {
                                                            return true
                                                        }
                                                        return false
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell className="p-1 px-2">
                                                <FormField
                                                    control={form.control}
                                                    name={`boms.${bomIndex}.lines.${index}.quantity`}
                                                    render={({ field }) => (
                                                        <Input
                                                            type="number"
                                                            step="0.0001"
                                                            {...field}
                                                            className="h-8 text-center text-[11px] font-mono px-1"
                                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                        />
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell className="p-1 px-2 text-center">
                                                <FormField
                                                    control={form.control}
                                                    name={`boms.${bomIndex}.lines.${index}.uom`}
                                                    render={({ field }) => {
                                                        const componentId = form.watch(`boms.${bomIndex}.lines.${index}.component`);
                                                        const product = products.find((p: any) => p.id.toString() === componentId?.toString());

                                                        // Get UoM IDs, not names
                                                        const uomIds = new Set<string>();
                                                        if (product) {
                                                            if (product.uom) uomIds.add(product.uom.toString());
                                                            if (product.sale_uom) uomIds.add(product.sale_uom.toString());
                                                            if (product.purchase_uom) uomIds.add(product.purchase_uom.toString());

                                                            if (product.allowed_sale_uoms) {
                                                                product.allowed_sale_uoms.forEach((uomInfo: any) => {
                                                                    // Handle both ID and object
                                                                    if (typeof uomInfo === 'object' && uomInfo.id) {
                                                                        uomIds.add(uomInfo.id.toString());
                                                                    } else {
                                                                        uomIds.add(uomInfo.toString());
                                                                    }
                                                                });
                                                            }
                                                        }

                                                        // Filter uoms to only show those related to product's category
                                                        const availableUoms = uoms.filter((u: any) => uomIds.has(u.id.toString()));

                                                        return (
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <FormControl>
                                                                        <Button
                                                                            variant="outline"
                                                                            role="combobox"
                                                                            className="h-8 text-[10px] px-2 w-full justify-between font-normal"
                                                                        >
                                                                            {field.value
                                                                                ? availableUoms.find((u: any) => u.id.toString() === field.value.toString())?.name
                                                                                : "-"}
                                                                            <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                                                        </Button>
                                                                    </FormControl>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                                                    <div className="p-2">
                                                                        <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                                                                            <Search className="mr-2 h-3 w-3 shrink-0 opacity-50" />
                                                                            <input
                                                                                className="flex h-8 w-full rounded-md bg-transparent py-2 text-xs outline-none placeholder:text-muted-foreground"
                                                                                placeholder="Buscar UdM..."
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value.toLowerCase()
                                                                                    const inputs = document.querySelectorAll('.uom-item-mfg')
                                                                                    inputs.forEach((el) => {
                                                                                        if (el.textContent?.toLowerCase().includes(val)) {
                                                                                            (el as HTMLElement).style.display = 'flex'
                                                                                        } else {
                                                                                            (el as HTMLElement).style.display = 'none'
                                                                                        }
                                                                                    })
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <div className="max-h-[150px] overflow-y-auto space-y-1">
                                                                            {availableUoms.map((u: any) => (
                                                                                <div
                                                                                    key={u.id}
                                                                                    className={cn(
                                                                                        "uom-item-mfg relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground",
                                                                                        field.value === u.id.toString() && "bg-accent"
                                                                                    )}
                                                                                    onClick={() => {
                                                                                        field.onChange(u.id.toString())
                                                                                        document.body.click()
                                                                                    }}
                                                                                >
                                                                                    <span>{u.name}</span>
                                                                                    {field.value === u.id.toString() && (
                                                                                        <Check className="ml-auto h-3 w-3 opacity-100" />
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                            {availableUoms.length === 0 && (
                                                                                <div className="p-3 text-[10px] text-center text-muted-foreground">
                                                                                    Seleccione componente
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </PopoverContent>
                                                            </Popover>
                                                        );
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell className="p-1 px-1 text-center">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                    onClick={() => remove(index)}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </div>
    )
}
