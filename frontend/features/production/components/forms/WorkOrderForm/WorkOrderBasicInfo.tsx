import React from "react"
import { useFormContext } from "react-hook-form"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import { FileText, User, ExternalLink, CalendarIcon, X } from "lucide-react"

import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"

import { ProductSelector } from "@/components/selectors/ProductSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"
import { AdvancedSaleOrderSelector } from "@/components/selectors/AdvancedSaleOrderSelector"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"

import { cn } from "@/lib/utils"
import { FORM_STYLES } from "@/lib/styles"
import type { WorkOrderFormValues, WorkOrderInitialData } from "@/types/forms"

interface WorkOrderBasicInfoProps {
    otType: "LINKED" | "NONE"
    initialData?: WorkOrderInitialData
    isAutoCreated: boolean
    linkedSaleOrder?: any
    saleLines: any[]
    loadingLines: boolean
    uoms: any[]
    selectedContact: any
    setSelectedContact: (c: any) => void
    selectedManualProduct: any
    handleManualProductSelect: (p: any) => void
    watchedSaleOrder: string | undefined
    watchedSaleLineId: string | undefined
}

export function WorkOrderBasicInfo({
    otType,
    initialData,
    isAutoCreated,
    linkedSaleOrder,
    saleLines,
    loadingLines,
    uoms,
    selectedContact,
    setSelectedContact,
    selectedManualProduct,
    handleManualProductSelect,
    watchedSaleOrder,
    watchedSaleLineId,
}: WorkOrderBasicInfoProps) {
    const form = useFormContext<WorkOrderFormValues>()

    return (
        <div className="space-y-6">
            <div className={cn("grid grid-cols-1 gap-4", otType === "NONE" ? "md:grid-cols-1" : "md:grid-cols-2")}>
                {otType === "LINKED" && (
                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={FORM_STYLES.label}>Descripción / Título</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ej: Impresión Folletos 1000u" className={cn(FORM_STYLES.input, "focus-visible:ring-primary")} {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <div className="flex flex-col gap-2">
                    {isAutoCreated ? (
                        <div className="space-y-2">
                            <Label className="text-sm">Vínculo de Venta</Label>
                            <div className="p-3 bg-muted/40 rounded-md border text-sm flex items-center justify-between group">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-primary">
                                            {initialData?.sale_order_number ? `NV-${initialData.sale_order_number}` : "Sin NV"}
                                        </span>
                                        <span className="text-muted-foreground">
                                            - {(initialData?.sale_line as any)?.product?.name || (initialData?.sale_line as any)?.description || ''}
                                        </span>
                                    </div>
                                </div>
                                {linkedSaleOrder && (
                                    <Link href={`/sales/command-center?id=${typeof linkedSaleOrder === 'object' ? linkedSaleOrder.id : linkedSaleOrder}`} target="_blank" passHref>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    ) : otType === "LINKED" ? (
                        <FormField
                            control={form.control}
                            name="sale_order"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Nota de Venta</FormLabel>
                                    <FormControl>
                                        <AdvancedSaleOrderSelector
                                            value={field.value}
                                            onChange={field.onChange}
                                            disabled={!!initialData}
                                            customFilter={(order: any) =>
                                                order.lines?.some((l: any) =>
                                                    l.product_type === 'MANUFACTURABLE' &&
                                                    l.requires_advanced_manufacturing &&
                                                    !l.work_order_summary
                                                )
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    ) : null}
                </div>
            </div>

            {otType === "LINKED" && (
                <div className="p-4 bg-muted/20 border rounded-lg space-y-4">
                    <Label className="text-[10px] uppercase text-muted-foreground font-bold flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" /> Detalle de Producto en Venta
                    </Label>

                    {initialData ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Producto</p>
                                <p className="font-medium truncate">
                                    {(initialData.sale_line as any)
                                        ? ((initialData.sale_line as any).product?.name || (initialData.sale_line as any).description)
                                        : (initialData.product?.name || "Producto Manual")
                                    }
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Cantidad</p>
                                <p className="font-medium">
                                    {(initialData.sale_line as any)
                                        ? `${(initialData.sale_line as any).quantity} ${(initialData.sale_line as any).uom?.name || ''}`
                                        : `${initialData.stage_data?.quantity || 0} ${initialData.stage_data?.uom_name || ""}`
                                    }
                                </p>
                            </div>
                            {initialData.sale_order_delivery_date && (
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">F. Entrega Planificada</p>
                                    <p className="font-medium text-primary">
                                        {format(new Date(String(initialData.sale_order_delivery_date) + 'T12:00:00'), "dd/MM/yyyy")}
                                    </p>
                                </div>
                            )}
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Progreso OT</p>
                                <p className="font-medium">{initialData.production_progress}%</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {watchedSaleOrder && watchedSaleOrder !== "__none__" && watchedSaleOrder !== "none" && (
                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="sale_line"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className={FORM_STYLES.label}>Ítem de Venta a Fabricar</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                    disabled={!!initialData}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger className={FORM_STYLES.input}>
                                                            <SelectValue placeholder="Seleccionar ítem..." />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {loadingLines ? (
                                                            <SelectItem value="loading" disabled>Cargando líneas...</SelectItem>
                                                        ) : saleLines.length === 0 ? (
                                                            <SelectItem value="none" disabled>No hay ítems fabricables avanzados pendientes</SelectItem>
                                                        ) : (
                                                            saleLines.map((line) => (
                                                                <SelectItem key={line.id} value={line.id.toString()}>
                                                                    {line.product_name || line.description} ({line.quantity} {line.uom_name})
                                                                </SelectItem>
                                                            ))
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {watchedSaleLineId && (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-3 bg-background rounded border animate-in fade-in slide-in-from-top-1">
                                            {(() => {
                                                const l = saleLines.find(x => x.id.toString() === watchedSaleLineId)
                                                if (!l) return null
                                                return (
                                                    <>
                                                        <div>
                                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Cantidad</p>
                                                            <p className="text-sm font-medium">{l.quantity} {l.uom_name}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Precio Unit.</p>
                                                            <p className="text-sm font-medium">${parseFloat(l.unit_price).toLocaleString()}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Subtotal</p>
                                                            <p className="text-sm font-bold text-primary">${parseFloat(l.subtotal).toLocaleString()}</p>
                                                        </div>
                                                    </>
                                                )
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {otType === "NONE" && !initialData && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-muted/10 p-4 rounded-lg border border-dashed">
                    <div className="md:col-span-6">
                        <FormField
                            control={form.control}
                            name="product_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Producto a Fabricar (Stock)</FormLabel>
                                    <FormControl>
                                        <ProductSelector
                                            value={field.value}
                                            onChange={field.onChange}
                                            onSelect={handleManualProductSelect}
                                            productType="MANUFACTURABLE"
                                            customFilter={(p: any) =>
                                                !p.requires_advanced_manufacturing &&
                                                !p.mfg_auto_finalize
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <div className="md:col-span-3">
                        <FormField
                            control={form.control}
                            name="quantity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Cantidad</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="1" placeholder="0" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <div className="md:col-span-3">
                        <FormField
                            control={form.control}
                            name="uom_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">U. Medida</FormLabel>
                                    <FormControl>
                                        <UoMSelector
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                            uoms={uoms}
                                            categoryId={selectedManualProduct?.uom_category}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b">
                <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel className={FORM_STYLES.label}>Fecha Inicio</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full pl-3 text-left font-normal border-dashed",
                                                !field.value && "text-muted-foreground"
                                            )}
                                        >
                                            {field.value ? format(field.value, "PPP", { locale: es }) : <span>Elegir fecha</span>}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value || undefined}
                                        onSelect={field.onChange}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel className={FORM_STYLES.label}>Fecha Entrega</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full pl-3 text-left font-normal border-dashed",
                                                !field.value && "text-muted-foreground"
                                            )}
                                        >
                                            {field.value ? format(field.value, "PPP", { locale: es }) : <span>Elegir fecha</span>}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value || undefined}
                                        onSelect={field.onChange}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            {otType === "LINKED" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b">
                    <FormField
                        control={form.control}
                        name="product_description"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={cn(FORM_STYLES.label, "flex items-center gap-2")}>
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    Descripción del Producto
                                </FormLabel>
                                <FormControl>
                                    <Input placeholder="Ej: Trípticos 10x21cm, Papel Couche 170gr..." className={cn(FORM_STYLES.input, "focus-visible:ring-primary")} {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            <User className="h-4 w-4 text-muted-foreground" />
                            Contacto Relacionado
                        </Label>
                        {selectedContact ? (
                            <div className="flex items-center justify-between p-2 rounded-xl bg-primary/5 border border-primary/20 h-10">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <User className="h-4 w-4 text-primary shrink-0" />
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-[13px] truncate font-bold leading-tight">{selectedContact.name}</span>
                                        {selectedContact.tax_id && <span className="text-[10px] font-mono text-muted-foreground border-t border-border mt-0.5 pt-0.5">{selectedContact.tax_id}</span>}
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                                    onClick={() => {
                                        setSelectedContact(null)
                                        form.setValue('contact_id', "")
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <AdvancedContactSelector
                                onSelectContact={(c) => {
                                    setSelectedContact(c)
                                    form.setValue('contact_id', String(c.id))
                                }}
                                onChange={() => { }}
                                placeholder="Buscar contacto..."
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
