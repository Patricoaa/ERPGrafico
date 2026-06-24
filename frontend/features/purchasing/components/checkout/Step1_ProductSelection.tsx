"use client"

import { useState, useEffect, useMemo } from "react"
import {
    TableBody,
    TableCell,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calculator, ShoppingCart, AlertTriangle } from "lucide-react"
import { useForm, useFieldArray } from "react-hook-form"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"
import { useVatRate } from '@/hooks/useVatRate'
import { purchasingApi } from "../../api/purchasingApi"
import { toast } from "sonner"

import { type CheckoutLine } from "../../types"
import { type ProductMinimal, type UoM } from "@/types/entities"
import { formatCurrency } from "@/lib/money"
import { DataCell, MoneyDisplay, FormLineItemsTable } from '@/components/shared'

interface Step1_ProductSelectionProps {
    orderLines: CheckoutLine[]
    setOrderLines: (lines: CheckoutLine[] | ((prev: CheckoutLine[]) => CheckoutLine[])) => void
    selectedWarehouseId?: string
    onWarehouseChange?: (id: string) => void
    selectedSupplierId?: string | null
}

const COLUMNS = [
    { header: "Producto", width: "w-[50%]", align: "left" as const },
    { header: "Cantidad", width: "w-[8%]", align: "center" as const },
    { header: "Unidad", width: "w-[16%]", align: "left" as const },
    { header: "Costo Unit.", width: "w-[10%]", align: "left" as const },
    { header: "Subtotal", width: "w-[10%]", align: "right" as const },
    { header: "", width: "w-[6%]" },
]

function GrossToNetCalculator({ rate, multiplier }: { rate: number; multiplier: number }) {
    const [grossInput, setGrossInput] = useState("")
    const netResult = grossInput ? Math.round(Number(grossInput) / multiplier) : null
    const ivaAmount = netResult !== null ? Math.round(Number(grossInput)) - netResult : null

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-primary transition-colors"
                    title="Calculadora bruto a neto"
                >
                    <Calculator className="h-3 w-3" />
                    Bruto → Neto
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4" align="end">
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-primary" />
                        <p className="text-[12px] font-bold uppercase tracking-wide">Conversor Bruto → Neto</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                        Útil para boletas. Ingresa el precio bruto (IVA incluido) para obtener el neto.
                    </p>
                    <div className="space-y-1.5">
                        <div className="space-y-1.5">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground px-0.5">Monto Bruto (c/IVA)</span>
                            <Input
                                type="number"
                                placeholder="Ej: 11.900"
                                value={grossInput}
                                onChange={(e) => setGrossInput(e.target.value)}
                                className="h-8 text-sm"
                            />
                        </div>
                        {netResult !== null && (
                            <div className="rounded-md bg-muted/60 border p-3 space-y-1.5 text-[12px]">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Neto (sin IVA)</span>
                                    <span className="font-bold text-success">
                                        {formatCurrency(netResult)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">IVA ({rate}%)</span>
                                    <span className="font-medium">
                                        {formatCurrency(ivaAmount ?? 0)}
                                    </span>
                                </div>
                                <div className="border-t pt-1.5 flex justify-between">
                                    <span className="text-muted-foreground">Bruto</span>
                                    <span className="font-medium">
                                        {formatCurrency(Number(grossInput))}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

interface FormValues {
    lines: CheckoutLine[]
}

export function Step1_ProductSelection({
    orderLines,
    setOrderLines,
    selectedWarehouseId,
    onWarehouseChange,
    selectedSupplierId
}: Step1_ProductSelectionProps) {
    const { rate, multiplier } = useVatRate()
    const [products, setProducts] = useState<ProductMinimal[]>([])
    const [uoms, setUoMs] = useState<UoM[]>([])
    const [loading, setLoading] = useState(true)

    const defaultLine = useMemo<CheckoutLine>(() => ({
        product: "",
        product_name: "",
        quantity: 1,
        unit_cost: 0,
        uom: "",
        uom_name: "",
        tax_rate: rate,
    }), [rate])

    const form = useForm<FormValues>({
        defaultValues: {
            lines: orderLines.length > 0 ? orderLines : [{ ...defaultLine }],
        },
    })
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "lines",
        keyName: "_key",
    })

    // Sync form changes to parent (strip auto-generated keys)
    useEffect(() => {
        const sub = form.watch((value) => {
            if (value.lines) {
                const cleanLines = (value.lines as any[]).map(l => ({
                    ...l,
                    id: typeof l.id === "number" ? l.id : undefined,
                })) as CheckoutLine[]
                setOrderLines(cleanLines)
            }
        })
        return () => sub.unsubscribe()
    }, [form, setOrderLines])

    // Auto-initialize with one empty line
    useEffect(() => {
        if (fields.length === 0) {
            append({ ...defaultLine })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Fetch products and UoMs
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [allProducts, uomsData] = await Promise.all([
                    purchasingApi.getPurchasableProducts(),
                    purchasingApi.getUoms(),
                ])
                setProducts(allProducts as any)
                setUoMs(uomsData as any)
            } catch (error) {
                console.error("Error fetching data:", error)
                toast.error("Error al cargar productos")
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    const handleProductChange = (index: number, productId: string | null) => {
        if (!productId) {
            form.setValue(`lines.${index}.product`, "")
            return
        }
        const product = products.find(p => p.id.toString() === productId)
        if (product) {
            form.setValue(`lines.${index}.product`, productId)
            form.setValue(`lines.${index}.name`, product.name)
            form.setValue(`lines.${index}.product_name`, product.name)
            form.setValue(`lines.${index}.unit_cost`, parseFloat(String(product.last_purchase_price || 0)) || 0)
            const uomId = (product.purchase_uom || product.uom)?.toString() || ""
            form.setValue(`lines.${index}.uom`, uomId)
            form.setValue(`lines.${index}.uom_name`, uoms.find(u => u.id.toString() === uomId)?.name || "")
            form.setValue(`lines.${index}.product_type`, product.product_type || "")

            if (!selectedWarehouseId && product.receiving_warehouse && onWarehouseChange) {
                onWarehouseChange(product.receiving_warehouse.toString())
            }
        } else {
            form.setValue(`lines.${index}.product`, productId)
        }
    }

    return (
        <FormLineItemsTable
            icon={ShoppingCart}
            title="Selección de Productos"
            columns={COLUMNS}
            onAdd={() => append({ ...defaultLine })}
            addButtonText="Agregar Producto"
            isLoading={loading}
            footer={<GrossToNetCalculator rate={rate} multiplier={multiplier} />}
        >
            <TableBody>
                {fields.map((field, index) => {
                    const lineProductId = form.watch(`lines.${index}.product`)?.toString() || ""
                    const product = products.find(p => p.id.toString() === lineProductId)
                    const lineQty = form.watch(`lines.${index}.quantity`) || 0
                    const lineCost = form.watch(`lines.${index}.unit_cost`) || 0
                    const lineUom = form.watch(`lines.${index}.uom`)?.toString() || ""

                    return (
                        <TableRow key={field._key} className="hover:bg-primary/5 transition-colors">
                            <TableCell className="py-2 px-3">
                                <ProductSelector
                                    value={lineProductId}
                                    context="purchase"
                                    onChange={(val) => handleProductChange(index, val)}
                                    variant="inline"
                                    placeholder="Seleccionar..."
                                    className="border border-input rounded-sm h-8"
                                />
                                {(() => {
                                    const prefSupplierId = product?.preferred_supplier && (
                                        typeof product.preferred_supplier === "object"
                                            ? product.preferred_supplier.id
                                            : product.preferred_supplier
                                    )
                                    if (product && prefSupplierId && selectedSupplierId && prefSupplierId.toString() !== selectedSupplierId) {
                                        return (
                                            <div className="flex items-center gap-1 mt-1 text-[10px] text-warning font-medium">
                                                <AlertTriangle className="h-3 w-3" />
                                                Sugerido: {product.preferred_supplier_name}
                                            </div>
                                        )
                                    }
                                    return null
                                })()}
                            </TableCell>
                            <TableCell className="py-2 px-3 text-center">
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="w-full text-center h-8 bg-background"
                                    value={lineQty}
                                    onChange={(e) => form.setValue(`lines.${index}.quantity`, parseFloat(e.target.value) || 0)}
                                />
                            </TableCell>
                            <TableCell className="py-2 px-3">
                                <UoMSelector
                                    product={product as any}
                                    context="purchase"
                                    value={lineUom}
                                    onChange={(val) => {
                                        const uomName = uoms.find(u => u.id.toString() === val)?.name
                                        form.setValue(`lines.${index}.uom`, val)
                                        form.setValue(`lines.${index}.uom_name`, uomName || "")
                                    }}
                                    uoms={uoms}
                                    showConversionHint={true}
                                    quantity={Number(lineQty) || 1}
                                    variant="inline"
                                    className="h-8"
                                />
                            </TableCell>
                            <TableCell className="py-2 px-3">
                                <Input
                                    type="number"
                                    step="1"
                                    className="w-full h-8 bg-background"
                                    value={lineCost}
                                    onChange={(e) => form.setValue(`lines.${index}.unit_cost`, parseFloat(e.target.value) || 0)}
                                />
                            </TableCell>
                            <TableCell className="py-2 px-3 text-right font-medium">
                                <MoneyDisplay amount={Number(lineQty) * Number(lineCost)} />
                            </TableCell>
                            <TableCell className="py-2 px-3 text-center">
                                <DataCell.Action
                                    action="delete"
                                    onClick={() => remove(index)}
                                    disabled={fields.length === 1}
                                />
                            </TableCell>
                        </TableRow>
                    )
                })}
            </TableBody>
        </FormLineItemsTable>
    )
}
