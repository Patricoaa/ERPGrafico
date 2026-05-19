import { useFormContext } from "react-hook-form"
import Link from "next/link"
import { FileText, User, ExternalLink, X } from "lucide-react"
import { formatCurrency } from "@/lib/money"

import { FormField } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"
import { AdvancedSaleOrderSelector } from "@/components/selectors/AdvancedSaleOrderSelector"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { LabeledInput, LabeledContainer, LabeledSelect, PeriodValidationDateInput } from "@/components/shared"

import { cn, formatPlainDate } from "@/lib/utils"
import { formatEntityDisplay } from "@/lib/entity-registry"
import type { WorkOrderFormValues, WorkOrderInitialData } from "@/types/forms"
import type { SaleOrder, SaleOrderLine } from "@/features/sales/types"
import type { Contact } from "@/features/contacts/types"
import type { UoM, ProductMinimal } from "../../../types"

interface WorkOrderBasicInfoProps {
    initialData?: WorkOrderInitialData
    isAutoCreated: boolean
    linkedSaleOrder?: SaleOrder | number | string
    saleLines: SaleOrderLine[]
    loadingLines: boolean
    uoms: UoM[]
    selectedContact: Contact | null
    setSelectedContact: (c: Contact | null) => void
    selectedManualProduct: ProductMinimal | null
    handleManualProductSelect: (p: ProductMinimal) => void
    watchedSaleOrder: string | undefined
    watchedSaleLineId: string | undefined
}

export function WorkOrderBasicInfo({
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
    const otType = form.watch('otType')

    return (
        <div className="space-y-6">
            <div className={cn("grid grid-cols-1 gap-4", otType === "NONE" ? "md:grid-cols-1" : "md:grid-cols-2")}>
                {otType === "LINKED" && (
                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                label="Descripción / Título"
                                placeholder="Ej: Impresión Folletos 1000u"
                                error={fieldState.error?.message}
                                {...field}
                            />
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
                                            {initialData?.sale_order_number ? formatEntityDisplay('sales.saleorder', { number: initialData.sale_order_number }) : "Sin NV"}
                                        </span>
                                        <span className="text-muted-foreground">
                                            - {typeof initialData?.sale_line === 'object'
                                                ? (initialData.sale_line?.product?.name || initialData.sale_line?.description || '')
                                                : ''}
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
                            render={({ field, fieldState }) => (
                                <AdvancedSaleOrderSelector
                                    value={field.value}
                                    onChange={field.onChange}
                                    disabled={!!initialData}
                                    label="Nota de Venta"
                                    error={fieldState.error?.message}
                                    icon={<FileText className="h-3.5 w-3.5 opacity-50" />}
                                    customFilter={(order: any) =>
                                        order.lines?.some((l: any) =>
                                            l.product_type === 'MANUFACTURABLE' &&
                                            l.requires_advanced_manufacturing &&
                                            !l.work_order_summary
                                        )
                                    }
                                />
                            )}
                        />
                    ) : null}
                </div>
            </div>

            {initialData ? (
                <div className="p-4 bg-muted/20 border rounded-lg space-y-4">
                    <Label className="text-[10px] uppercase text-muted-foreground font-bold flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" /> Detalle de Producto {otType === "LINKED" ? "en Venta" : "en Stock"}
                    </Label>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-semibold">Producto</p>
                            <p className="font-medium truncate">
                                {typeof initialData.sale_line === 'object'
                                    ? (initialData.sale_line?.product?.name || initialData.sale_line?.description)
                                    : (initialData.product?.name || "Producto Manual")
                                }
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-semibold">Cantidad</p>
                            <p className="font-medium">
                                {typeof initialData.sale_line === 'object'
                                    ? `${initialData.sale_line?.quantity} ${initialData.sale_line?.uom?.name || ''}`
                                    : `${initialData.stage_data?.quantity || 0} ${initialData.stage_data?.uom_name || ""}`
                                }
                            </p>
                        </div>
                        {otType === "LINKED" && initialData.sale_order_delivery_date && (
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">F. Entrega Planificada</p>
                                <p className="font-medium text-primary">
                                    {formatPlainDate(String(initialData.sale_order_delivery_date))}
                                </p>
                            </div>
                        )}
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-semibold">Progreso OT</p>
                            <p className="font-medium">{initialData.production_progress}%</p>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {otType === "LINKED" && (
                        <div className="p-4 bg-muted/20 border rounded-lg space-y-4">
                            <Label className="text-[10px] uppercase text-muted-foreground font-bold flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5" /> Detalle de Producto en Venta
                            </Label>
                            <div className="space-y-6">
                                {watchedSaleOrder && watchedSaleOrder !== "__none__" && watchedSaleOrder !== "none" && (
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="sale_line"
                                            render={({ field }) => (
                                                <LabeledSelect
                                                    label="Ítem de Venta a Fabricar"
                                                    onChange={field.onChange}
                                                    value={field.value}
                                                    disabled={!!initialData}
                                                    placeholder={loadingLines ? "Cargando..." : "Seleccionar ítem..."}
                                                    options={saleLines.length === 0
                                                        ? [{ value: "none", label: "No hay ítems fabricables avanzados pendientes" }]
                                                        : saleLines.map((line: SaleOrderLine) => ({
                                                            value: line.id?.toString() || "",
                                                            label: `${line.product_name || line.description} (${line.quantity} ${line.uom_name})`,
                                                        }))}
                                                />
                                            )}
                                        />

                                        {watchedSaleLineId && (
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-3 bg-background rounded border animate-in fade-in slide-in-from-top-1">
                                                {(() => {
                                                    const l = saleLines.find(x => x.id?.toString() === watchedSaleLineId)
                                                    if (!l) return null
                                                    return (
                                                        <>
                                                            <div>
                                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Cantidad</p>
                                                                <p className="text-sm font-medium">{l.quantity} {l.uom_name}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Precio Unit.</p>
                                                                <p className="text-sm font-medium">{formatCurrency(parseFloat(String(l.unit_price)))}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Subtotal</p>
                                                                <p className="text-sm font-bold text-primary">{formatCurrency(parseFloat(String((l as any).subtotal || 0)))}</p>
                                                            </div>
                                                        </>
                                                    )
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {otType === "NONE" && (
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-6">
                                <FormField
                                    control={form.control}
                                    name="product_id"
                                    render={({ field, fieldState }) => (
                                        <ProductSelector
                                            value={field.value}
                                            onChange={field.onChange}
                                            onSelect={handleManualProductSelect}
                                            productType="MANUFACTURABLE"
                                            label="Producto a Fabricar (Stock)"
                                            error={fieldState.error?.message}
                                            customFilter={(p: ProductMinimal) =>
                                                !p.requires_advanced_manufacturing &&
                                                !p.mfg_auto_finalize
                                            }
                                        />
                                    )}
                                />
                            </div>
                            <div className="md:col-span-3">
                                <FormField
                                    control={form.control}
                                    name="quantity"
                                    render={({ field, fieldState }) => (
                                        <LabeledInput
                                            label="Cantidad"
                                            type="number"
                                            step="1"
                                            placeholder="0"
                                            error={fieldState.error?.message}
                                            {...field}
                                        />
                                    )}
                                />
                            </div>
                            <div className="md:col-span-3">
                                <FormField
                                    control={form.control}
                                    name="uom_id"
                                    render={({ field, fieldState }) => (
                                        <UoMSelector
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                            uoms={uoms}
                                            categoryId={selectedManualProduct?.uom_category}
                                            label="U. Medida"
                                            error={fieldState.error?.message}
                                        />
                                    )}
                                />
                            </div>
                        </div>
                    )}
                </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                        <PeriodValidationDateInput
                            date={field.value || undefined}
                            onDateChange={field.onChange}
                            label="Fecha Inicio"
                            validationType="tax"
                            required
                        />
                    )}
                />
                <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                        <PeriodValidationDateInput
                            date={field.value || undefined}
                            onDateChange={field.onChange}
                            label="Fecha Entrega"
                            validationType="tax"
                            required
                        />
                    )}
                />
            </div>

            {otType === "LINKED" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                    <FormField
                        control={form.control}
                        name="product_description"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                label="Descripción del Producto"
                                placeholder="Ej: Trípticos 10x21cm, Papel Couche 170gr..."
                                error={fieldState.error?.message}
                                {...field}
                            />
                        )}
                    />
                    <LabeledContainer label="Contacto Relacionado">
                        {selectedContact ? (
                            <div className="flex items-center justify-between w-full h-[1.5rem]">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <User className="h-3.5 w-3.5 text-primary shrink-0" />
                                    <span className="font-semibold text-sm truncate">{selectedContact.name}</span>
                                    {selectedContact.tax_id && (
                                        <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
                                            [{selectedContact.tax_id}]
                                        </span>
                                    )}
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0"
                                    onClick={() => {
                                        setSelectedContact(null)
                                        form.setValue('contact_id' as never, "" as never)
                                    }}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ) : (
                            <AdvancedContactSelector
                                onSelectContact={(c: any) => {
                                    setSelectedContact(c)
                                    form.setValue('contact_id' as never, String(c.id) as never)
                                }}
                                onChange={() => { }}
                                placeholder="Buscar contacto..."
                                variant="inline"
                                className="h-[1.5rem] px-0 border-none bg-transparent hover:bg-transparent shadow-none text-sm text-muted-foreground font-normal"
                            />
                        )}
                    </LabeledContainer>
                </div>
            )}
        </div>
    )
}
