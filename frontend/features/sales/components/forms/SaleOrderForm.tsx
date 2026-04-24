"use client"

import { showApiError } from "@/lib/errors"

import { useState, useEffect } from "react"
import { useForm, useFieldArray, useWatch, Control } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { FORM_STYLES } from "@/lib/styles"
import { BaseModal, ActionSlideButton, MoneyDisplay, LabeledInput } from "@/components/shared"
import {
    Form,
    FormField
} from "@/components/ui/form"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"
import { PricingUtils } from '@/features/inventory/utils/pricing'
import { useStockValidation } from "@/hooks/useStockValidation"
import { SaleOrder, SaleOrderLine, SaleOrderPayload } from "../../types"
import { Product } from "@/features/inventory/types"


interface UoM {
    id: number
    name: string
    category: number
    ratio: number
}

import { saleOrderSchema, type SaleOrderFormValues } from "./schema"

interface SaleOrderFormProps {
    onSuccess?: (order?: SaleOrder) => void
    onConfirmCheckout?: (data: SaleOrderPayload) => void
    initialData?: SaleOrder | Partial<SaleOrder>
    open?: boolean
    onOpenChange?: (open: boolean) => void
    triggerVariant?: "default" | "circular"
}

const OrderTotals = ({ control }: { control: Control<SaleOrderFormValues> }) => {
    const lines = useWatch({
        control,
        name: "lines",
    })

    const totals = PricingUtils.calculateMultiLineTotal(
        lines?.map(l => ({
            quantity: Number(l.quantity),
            unit_price_net: Number(l.unit_price),
            unit_price_gross: l.unit_price_gross ? Number(l.unit_price_gross) : undefined
        })) || []
    )

    return (
        <div className="space-y-1 text-right pt-4 border-t flex flex-col items-end">
            <div className="text-sm text-muted-foreground flex gap-1">
                <span>Subtotal:</span>
                <MoneyDisplay amount={totals.net} inline />
            </div>
            <div className="text-sm text-muted-foreground flex gap-1">
                <span>IVA (19%):</span>
                <MoneyDisplay amount={totals.tax} inline />
            </div>
            <div className="text-lg font-bold flex gap-1">
                <span>Total:</span>
                <MoneyDisplay amount={totals.gross} inline />
            </div>
        </div>
    )
}

export function SaleOrderForm({ onSuccess, onConfirmCheckout, initialData, open: openProp, onOpenChange, triggerVariant = "default" }: SaleOrderFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)
    const [products, setProducts] = useState<Product[]>([])
    const [uoms, setUoMs] = useState<UoM[]>([])
    const { checkAvailability, validateLine, getStockMessage } = useStockValidation()

    const form = useForm<SaleOrderFormValues>({
        resolver: zodResolver(saleOrderSchema) as any,
        defaultValues: initialData ? {
            ...initialData,
            lines: initialData?.lines?.map((l: SaleOrderLine) => ({
                id: l.id,
                product: l.product?.toString() || "",
                description: l.description,
                quantity: l.quantity || 0,
                uom: l.uom?.toString() || "",
                unit_price: l.unit_price || 0,
                unit_price_gross: l.unit_price_gross || (l.unit_price ? PricingUtils.netToGross(l.unit_price) : 0),
                tax_rate: l.tax_rate || 19,
                custom_specs: l.custom_specs || {},
                manufacturing_data: l.manufacturing_data || null,
            })) || []
        } : {
            payment_method: "CREDIT",
            notes: "",
            lines: [{ product: "", description: "", quantity: 1, uom: "", unit_price: 0, tax_rate: 19, custom_specs: {}, manufacturing_data: null }],
        },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "lines",
    })


    const fetchData = async () => {
        try {
            const [productsRes, uomsRes] = await Promise.all([
                api.get('/inventory/products/?can_be_sold=true'),
                api.get('/inventory/uoms/')
            ])
            setProducts(productsRes.data.results || productsRes.data)
            setUoMs(uomsRes.data.results || uomsRes.data)
        } catch (error) {
            console.error("Error fetching data:", error)
        }
    }

    const fetchEffectivePrice = async (product: Product, qty: number, selectedUomId?: number) => {
        if (!product || !product.id) return { net: 0, gross: 0 }
        try {
            const params: Record<string, string | number> = { quantity: qty }
            if (selectedUomId) params.uom_id = selectedUomId

            const response = await api.get(`/inventory/products/${product.id}/effective_price/`, { params })
            return {
                net: response.data.price_net || response.data.price,
                gross: response.data.price_gross
            }
        } catch (error) {
            console.error("Error fetching price:", error)
            const net = parseFloat(product.sale_price || "0")
            return {
                net,
                gross: parseFloat(product.sale_price_gross || "0") || PricingUtils.netToGross(net)
            }
        }
    }

    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                fetchData()
                if (initialData) {
                    form.reset({
                        ...initialData,
                        lines: initialData?.lines?.map((l: SaleOrderLine) => ({
                            id: l.id,
                            product: l.product?.toString() || "",
                            description: l.description,
                            quantity: l.quantity || 0,
                            uom: l.uom?.toString() || "",
                            unit_price: l.unit_price || 0,
                            unit_price_gross: l.unit_price_gross || (l.unit_price ? PricingUtils.netToGross(l.unit_price) : 0),
                            tax_rate: l.tax_rate || 19,
                            custom_specs: l.custom_specs || {},
                            manufacturing_data: l.manufacturing_data || null,
                        })) || []
                    })
                } else {
                    form.reset({
                        payment_method: "CREDIT",
                        notes: "",
                        lines: [{ product: "", description: "", quantity: 1, uom: "", unit_price: 0, unit_price_gross: 0, tax_rate: 19, custom_specs: {}, manufacturing_data: null }],
                    })
                }
            })
        }
    }, [open, initialData, form])

    async function onSubmit(data: SaleOrderFormValues) {
        // Validation for dynamic pricing
        const invalidLines = data.lines.filter(line => {
            const product = products.find(p => p.id.toString() === line.product);
            return product?.is_dynamic_pricing && (line.unit_price <= 0);
        });

        if (invalidLines.length > 0) {
            toast.error("Hay líneas con precio dinámico sin asignar (precio 0). Por favor asigne un precio unitario.");
            return;
        }

        // Stock validation before proceeding
        try {
            const stockCheck = await checkAvailability(
                data.lines
                    .filter(line => line.product) // Filter out lines without product
                    .map(line => ({
                        product_id: parseInt(line.product!),
                        quantity: line.quantity,
                        uom_id: parseInt(line.uom)
                    }))
            );

            if (!stockCheck.available) {
                const unavailableLines = stockCheck.details
                    .filter(d => !d.is_available)
                    .map(d => {
                        if (d.missing_components && d.missing_components.length > 0) {
                            const components = d.missing_components.map(c => c.component_name).join(', ');
                            return `${d.product_name} (faltan componentes: ${components})`;
                        }
                        return d.product_name;
                    });

                toast.error('Stock insuficiente', {
                    description: `Los siguientes productos no tienen stock disponible: ${unavailableLines.join(', ')}`
                });
                return;
            }
        } catch (error) {
            console.error('Error validating stock:', error);
            toast.error('Error al validar stock. Por favor, intente nuevamente.');
            return;
        }
        if (!initialData && onConfirmCheckout) {
            // Enrich data with names for the checkout summary
            const enrichedLines = data.lines.map(line => {
                const product = products.find(p => p.id.toString() === line.product);
                const uom = uoms.find(u => u.id.toString() === line.uom);
                return {
                    ...line,
                    product_name: product?.name || line.description,
                    uom_name: uom?.name || "",
                    product_type: product?.product_type,
                    requires_advanced_manufacturing: product?.requires_advanced_manufacturing,
                    has_bom: product?.has_bom,
                    mfg_enable_prepress: product?.mfg_enable_prepress,
                    mfg_enable_press: product?.mfg_enable_press,
                    mfg_enable_postpress: product?.mfg_enable_postpress,
                    mfg_prepress_design: product?.mfg_prepress_design,
                    mfg_prepress_folio: product?.mfg_prepress_folio,
                    mfg_press_offset: product?.mfg_press_offset,
                    mfg_press_digital: product?.mfg_press_digital,
                    mfg_press_special: product?.mfg_press_special,
                    mfg_auto_finalize: product?.mfg_auto_finalize,
                };
            });
            onConfirmCheckout({
                ...data,
                lines: enrichedLines as any,
                customer: (initialData as any)?.customer || null,
                date: new Date().toISOString()
            });
            setOpen(false)
            return
        }

        setLoading(true)
        try {
            let res;
            if (initialData) {
                res = await api.put(`/sales/orders/${initialData.id}/`, data)
                toast.success("Nota de Venta actualizada correctamente")
            } else {
                res = await api.post('/sales/orders/', data)
                toast.success("Nota de Venta creada correctamente")
            }
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess(res?.data)
        } catch (error: unknown) {
            console.error("Error saving sale order:", error)
            showApiError(error, "Error al guardar la Nota de Venta")
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            {!initialData && (
                <div onClick={() => setOpen(true)}>
                    {triggerVariant === "circular" ? (
                        <Button size="icon" className="rounded-full h-8 w-8" title="Nueva Nota de Venta">
                            <Plus className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button>Nueva Nota de Venta</Button>
                    )}
                </div>
            )}
            <BaseModal
                open={open}
                onOpenChange={setOpen}
                size="xl"
                title={initialData ? "Editar Nota de Venta" : "Cerrar Venta"}
                description={initialData ? "Modifique los datos de la nota de venta." : "Ingrese los productos la venta e ir al checkout."}
                footer={
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <ActionSlideButton type="submit" form="sale-order-form" disabled={loading}>
                            {loading ? "Guardando..." : initialData ? "Guardar Cambios" : "Confirmar Venta"}
                        </ActionSlideButton>
                    </>
                }
            >
                <Form {...form}>
                    <form id="sale-order-form" onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6 pt-4">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className={FORM_STYLES.sectionHeader}>Líneas de Venta</h3>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ product: "", description: "", quantity: 1, uom: "", unit_price: 0, unit_price_gross: 0, tax_rate: 19, custom_specs: {}, manufacturing_data: null })}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Agregar Línea
                                </Button>
                            </div>

                            <div className="rounded-lg border border-dashed">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[25%]">Producto</TableHead>
                                            <TableHead className="w-[10%]">Cantidad</TableHead>
                                            <TableHead className="w-[10%]">Unidad</TableHead>
                                            <TableHead className="w-[15%]">P. Unit.</TableHead>
                                            <TableHead className="w-[15%]">Total</TableHead>
                                            <TableHead className="w-[5%]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map((row, index) => (
                                            <TableRow key={row.id}>
                                                <TableCell className="align-top">
                                                    <FormField<SaleOrderFormValues>
                                                        control={form.control as any}
                                                        name={`lines.${index}.product`}
                                                        render={({ field }) => (
                                                            <div className="space-y-1">
                                                                <div className="flex gap-2 items-start">
                                                                    <div className="flex-1">
                                                                        <ProductSelector
                                                                            value={field.value as any}
                                                                            restrictStock={true}
                                                                            context="sale"
                                                                            onChange={async (value: string | null) => {
                                                                                const selectedProduct = products.find(p => p.id.toString() === value)

                                                                                if (selectedProduct?.product_type === 'CONSUMABLE') {
                                                                                    toast.error("Producto no vendible", {
                                                                                        description: "Los productos consumibles son para uso interno y no pueden venderse directamente."
                                                                                    })
                                                                                    return
                                                                                }

                                                                                field.onChange(value)
                                                                                // Auto-populate price, description and UoM from product
                                                                                if (selectedProduct) {
                                                                                    const qty = form.getValues(`lines.${index}.quantity`) || 1
                                                                                    const uomId = selectedProduct.uom

                                                                                    // Call API for price
                                                                                    const { net, gross } = await fetchEffectivePrice(selectedProduct, qty, uomId)

                                                                                    form.setValue(`lines.${index}.unit_price`, net)
                                                                                    form.setValue(`lines.${index}.unit_price_gross`, gross)
                                                                                    form.setValue(`lines.${index}.description`, selectedProduct.name)
                                                                                    form.setValue(`lines.${index}.uom`, uomId?.toString() || "")

                                                                                    // Reset custom specs if not custom manufacturable
                                                                                    if (selectedProduct.product_type !== 'MANUFACTURABLE_CUSTOM') {
                                                                                        form.setValue(`lines.${index}.custom_specs`, {})
                                                                                    }
                                                                                }
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                {(() => {
                                                                    const prod = products.find(p => p.id.toString() === field.value)
                                                                    if (!prod) return null

                                                                    return (
                                                                        <div className="space-y-2 mt-1">
                                                                            <div className="flex gap-1 flex-wrap">
                                                                                {prod.product_type === 'STORABLE' && (
                                                                                    <>
                                                                                        <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border leading-none",
                                                                                            (prod.current_stock || 0) > 0 ? "border-success/30 text-success bg-success/5" : "border-destructive/10 text-destructive/40 bg-muted/30"
                                                                                        )}>
                                                                                            Stock: {prod.current_stock || 0}
                                                                                        </span>
                                                                                        <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border leading-none",
                                                                                            (prod.qty_available || 0) > 0 ? "border-success/30 text-success bg-success/5" : "border-warning/30 text-warning bg-warning/5"
                                                                                        )}>
                                                                                            Disp: {prod.qty_available || 0}
                                                                                        </span>
                                                                                    </>
                                                                                )}

                                                                                {prod.product_type === 'MANUFACTURABLE' && prod.has_bom && (
                                                                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-info/30 text-info bg-info/5 leading-none">
                                                                                        Fab: {prod.manufacturable_quantity ?? 'N/A'}
                                                                                    </span>
                                                                                )}

                                                                                {(prod.product_type === 'MANUFACTURABLE' || prod.product_type === 'MANUFACTURABLE_CUSTOM') && prod.active && (
                                                                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-success/30 text-success bg-success/5 leading-none">
                                                                                        Disponible
                                                                                    </span>
                                                                                )}
                                                                            </div>

                                                                        </div>
                                                                    )
                                                                })()}
                                                            </div>
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell className="align-top">
                                                    <FormField<SaleOrderFormValues>
                                                        control={form.control as any}
                                                        name={`lines.${index}.quantity`}
                                                        render={({ field }) => (
                                                            <div className="flex flex-col gap-1">
                                                                <LabeledInput
                                                                    type="number"
                                                                    step="0.01"
                                                                    {...(field as any)}
                                                                    className={cn(
                                                                        "h-8",
                                                                        (() => {
                                                                            const productId = form.getValues(`lines.${index}.product`)
                                                                            const product = products.find(p => p.id.toString() === productId)
                                                                            if (!product) return ""
                                                                            let maxQty = Infinity
                                                                            if (product.product_type === 'STORABLE') maxQty = product.qty_available || 0
                                                                            if (product.product_type === 'MANUFACTURABLE' && product.has_bom) maxQty = product.manufacturable_quantity || 0

                                                                            // Highlight if at max
                                                                            const currentVal = parseFloat((field as any).value?.toString()) || 0
                                                                            return currentVal >= maxQty && maxQty > 0 ? "border-warning text-warning bg-warning/10" : ""
                                                                        })()
                                                                    )}
                                                                    onChange={async (e) => {
                                                                        let val = parseFloat(e.target.value) || 0

                                                                        // Strict MAX enforcement
                                                                        const productId = form.getValues(`lines.${index}.product`)
                                                                        const product = products.find(p => p.id.toString() === productId)

                                                                        if (product) {
                                                                            let maxQty = Infinity
                                                                            if (product.product_type === 'STORABLE') maxQty = product.qty_available || 0
                                                                            if (product.product_type === 'MANUFACTURABLE' && product.has_bom) maxQty = product.manufacturable_quantity || 0

                                                                            if (val > maxQty) {
                                                                                val = maxQty
                                                                                toast.info(`Stock máximo alcanzado: ${maxQty}`)
                                                                            }
                                                                        }

                                                                        field.onChange(val)

                                                                        // Re-evaluate price
                                                                        if (product) {
                                                                            const uomId = parseInt(form.getValues(`lines.${index}.uom`))
                                                                            const { net, gross } = await fetchEffectivePrice(product, val, isNaN(uomId) ? undefined : uomId)
                                                                            form.setValue(`lines.${index}.unit_price`, net)
                                                                            form.setValue(`lines.${index}.unit_price_gross`, gross)
                                                                        }
                                                                    }}
                                                                />
                                                                {(() => {
                                                                    const productId = form.getValues(`lines.${index}.product`)
                                                                    const product = products.find(p => p.id.toString() === productId)
                                                                    if (!product) return null

                                                                    let maxQty = null
                                                                    if (product.product_type === 'STORABLE') maxQty = product.qty_available || 0
                                                                    if (product.product_type === 'MANUFACTURABLE' && product.has_bom) maxQty = product.manufacturable_quantity ?? 0

                                                                    if (maxQty !== null && maxQty !== Infinity) {
                                                                        return (
                                                                            <div className="flex justify-end">
                                                                                <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase opacity-60">
                                                                                    MAX: {maxQty}
                                                                                </span>
                                                                            </div>
                                                                        )
                                                                    }
                                                                    return null
                                                                })()}
                                                            </div>
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell className="align-top">
                                                    <FormField<SaleOrderFormValues>
                                                        control={form.control as any}
                                                        name={`lines.${index}.uom`}
                                                        render={({ field }) => {
                                                            const productId = form.watch(`lines.${index}.product`) || ""
                                                            const selectedProduct = products.find(p => p.id.toString() === productId)
                                                            const quantity = Number(form.watch(`lines.${index}.quantity`)) || 1

                                                            return (
                                                                <UoMSelector
                                                                    product={selectedProduct || null}
                                                                    context="sale"
                                                                    value={(field as any).value || ""}
                                                                    onChange={async (val) => {
                                                                        field.onChange(val)
                                                                        const qty = Number(form.getValues(`lines.${index}.quantity`)) || 1
                                                                        const uomId = parseInt(val)
                                                                        if (selectedProduct) {
                                                                            const { net, gross } = await fetchEffectivePrice(selectedProduct, qty, isNaN(uomId) ? undefined : uomId)
                                                                            form.setValue(`lines.${index}.unit_price`, net)
                                                                            form.setValue(`lines.${index}.unit_price_gross`, gross)
                                                                        }
                                                                    }}
                                                                    uoms={uoms}
                                                                    showConversionHint={true}
                                                                    quantity={quantity}
                                                                    label="Unidad"
                                                                />
                                                            )
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right text-xs align-top">
                                                    <FormField<SaleOrderFormValues>
                                                        control={form.control as any}
                                                        name={`lines.${index}.unit_price_gross`}
                                                        render={({ field }) => {
                                                            const productId = form.watch(`lines.${index}.product`)
                                                            const product = products.find(p => p.id.toString() === productId)
                                                            const isDynamic = product?.is_dynamic_pricing
                                                            const grossPrice = Number(field.value) || 0
                                                            const netPrice = form.watch(`lines.${index}.unit_price`) || 0

                                                            return (
                                                                <div className="flex flex-col items-end gap-1 pt-2 pr-3">
                                                                    {isDynamic ? (
                                                                        <LabeledInput
                                                                            type="number"
                                                                            className="h-8 w-24 text-right pr-2"
                                                                            value={grossPrice || ""}
                                                                            placeholder="0"
                                                                            onChange={(e) => {
                                                                                const val = parseFloat(e.target.value) || 0;
                                                                                field.onChange(val);
                                                                                form.setValue(`lines.${index}.unit_price`, PricingUtils.grossToNet(val));
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <MoneyDisplay amount={grossPrice} className="font-bold" />
                                                                    )}
                                                                    <div className="text-[9px] text-muted-foreground leading-none flex items-center gap-1">
                                                                        Neto: <MoneyDisplay amount={netPrice} inline />
                                                                    </div>
                                                                </div>
                                                            )
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-sm align-top">
                                                    {(() => {
                                                        const qty = Number(form.watch(`lines.${index}.quantity`)) || 0
                                                        const unitGross = Number(form.watch(`lines.${index}.unit_price_gross`)) || 0
                                                        const unitNet = Number(form.watch(`lines.${index}.unit_price`)) || 0
                                                        const lineTotal = Math.round(qty * unitGross)
                                                        const lineNetTotal = Math.round(qty * unitNet)

                                                        return (
                                                            <div className="flex flex-col items-end gap-1">
                                                                <MoneyDisplay amount={lineTotal} />
                                                                <div className="text-[9px] text-muted-foreground font-normal leading-none opacity-80 flex gap-1">
                                                                    Neto: <MoneyDisplay amount={lineNetTotal} inline />
                                                                </div>
                                                            </div>
                                                        )
                                                    })()}
                                                </TableCell>
                                                <TableCell className="align-top">
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => remove(index)}
                                                            disabled={fields.length === 1}
                                                            className="h-8 w-8 text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <div className="w-full md:w-1/2">
                                <OrderTotals control={form.control as any} />
                            </div>
                        </div>
                    </form>
                </Form>
            </BaseModal>
        </>
    )
}

export default SaleOrderForm
