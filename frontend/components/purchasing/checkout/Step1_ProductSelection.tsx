"use client"

import { useState, useEffect } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, ShoppingCart } from "lucide-react"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"
import api from "@/lib/api"
import { toast } from "sonner"
import { PricingUtils } from "@/lib/pricing"

interface Step1_ProductSelectionProps {
    orderLines: any[]
    setOrderLines: (lines: any[] | ((prev: any[]) => any[])) => void
    selectedWarehouseId?: string
    onWarehouseChange?: (id: string) => void
    selectedSupplierId?: string | null
}

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Calculator, AlertTriangle } from "lucide-react"

export function Step1_ProductSelection({
    orderLines,
    setOrderLines,
    selectedWarehouseId,
    onWarehouseChange,
    selectedSupplierId
}: Step1_ProductSelectionProps) {
    const [products, setProducts] = useState<any[]>([])
    const [uoms, setUoMs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [grossInput, setGrossInput] = useState<string>("")
    const netResult = grossInput ? Math.round(Number(grossInput) / 1.19) : null
    const ivaAmount = netResult !== null ? Math.round(Number(grossInput)) - netResult : null

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [productsRes, uomsRes] = await Promise.all([
                    api.get('/inventory/products/?can_be_purchased=true'),
                    api.get('/inventory/uoms/'),
                ])

                const allProducts = productsRes.data.results || productsRes.data
                setProducts(allProducts)
                setUoMs(uomsRes.data.results || uomsRes.data)
            } catch (error) {
                console.error("Error fetching data:", error)
                toast.error("Error al cargar productos")
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    const handleAddLine = () => {
        setOrderLines([
            ...orderLines,
            { product: "", quantity: 1, uom: "", unit_cost: 0, tax_rate: 19 }
        ])
    }

    const handleRemoveLine = (index: number) => {
        if (orderLines.length > 1) {
            const newLines = [...orderLines]
            newLines.splice(index, 1)
            setOrderLines(newLines)
        }
    }

    const updateLine = (index: number, fieldOrUpdates: string | Record<string, any>, value?: any) => {
        setOrderLines(prev => {
            const newLines = [...prev]
            if (typeof fieldOrUpdates === 'string') {
                newLines[index] = { ...newLines[index], [fieldOrUpdates]: value }
            } else {
                newLines[index] = { ...newLines[index], ...fieldOrUpdates }
            }
            return newLines
        })
    }

    const handleProductChange = (index: number, productId: string | null) => {
        if (!productId) {
            updateLine(index, 'product', "")
            return
        }
        const product = products.find(p => p.id.toString() === productId)
        if (product) {
            updateLine(index, {
                product: productId,
                name: product.name,
                // Removed: id: product.id, which was overwriting line.id
                unit_cost: parseFloat(product.last_purchase_price) || 0,
                uom: (product.purchase_uom || product.uom)?.toString() || "",
                uom_name: uoms.find(u => u.id.toString() === ((product.purchase_uom || product.uom)?.toString()))?.name,
                product_type: product.product_type
            })

            // Suggest warehouse if not set
            if (!selectedWarehouseId && product.receiving_warehouse && onWarehouseChange) {
                onWarehouseChange(product.receiving_warehouse.toString())
            }
        } else {
            updateLine(index, 'product', productId)
        }
    }

    // Initialize with one line if empty
    useEffect(() => {
        if (orderLines.length === 0) {
            // Don't auto-add here to avoid infinite loops or overwriting if parent manages initial state differently, 
            // but normally checkout wizard starts with lines. If validly empty, maybe we should add one.
            // For now, let's leave it to user to add or parent to initialize.
            // Actually, standard behavior in form is to have at least one line.
            handleAddLine()
        }
    }, [])


    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    Selección de Productos
                </h3>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddLine}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Producto
                </Button>
            </div>

            <div className="rounded-md border flex-1 overflow-auto min-h-[400px]">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead className="w-[50%]">Producto</TableHead>
                            <TableHead className="w-[8%] text-center">Cantidad</TableHead>
                            <TableHead className="w-[16%]">Unidad</TableHead>
                            <TableHead className="w-[10%]">
                                <div className="flex items-center gap-1">
                                    Costo Unit.
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button
                                                type="button"
                                                className="text-muted-foreground/50 hover:text-primary transition-colors"
                                                title="Calculadora bruto a neto"
                                            >
                                                <Calculator className="h-3 w-3" />
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 p-4" align="start">
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Calculator className="h-4 w-4 text-primary" />
                                                    <p className="text-[12px] font-bold uppercase tracking-wide">Conversor Bruto → Neto</p>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground">Útil para boletas. Ingresa el precio bruto (IVA incluido) para obtener el neto.</p>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase font-bold">Monto Bruto (c/IVA)</Label>
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
                                                            <span className="font-bold text-emerald-700">
                                                                {netResult.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">IVA (19%)</span>
                                                            <span className="font-medium">
                                                                {ivaAmount?.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                                            </span>
                                                        </div>
                                                        <div className="border-t pt-1.5 flex justify-between">
                                                            <span className="text-muted-foreground">Bruto</span>
                                                            <span className="font-medium">
                                                                {Number(grossInput).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </TableHead>
                            <TableHead className="w-[10%] text-right">Subtotal</TableHead>
                            <TableHead className="w-[6%]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orderLines.map((line, index) => (
                            <TableRow key={index}>
                                <TableCell>
                                    <ProductSelector
                                        value={line.product?.toString() || line.id?.toString() || ""}
                                        context="purchase"
                                        onChange={(val) => handleProductChange(index, val)}
                                    />
                                    {(() => {
                                        const product = products.find(p => p.id.toString() === (line.product?.toString() || line.id?.toString()))
                                        if (product && product.preferred_supplier && selectedSupplierId && product.preferred_supplier.toString() !== selectedSupplierId) {
                                            return (
                                                <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-600 font-medium">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    Sugerido: {product.preferred_supplier_name}
                                                </div>
                                            )
                                        }
                                        return null
                                    })()}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="w-full text-center"
                                        value={line.quantity || line.qty || 0}
                                        onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <UoMSelector
                                        product={products.find(p => p.id.toString() === (line.product?.toString() || line.id?.toString())) || null}
                                        context="purchase"
                                        value={line.uom?.toString() || ""}
                                        onChange={(val) => {
                                            const uomName = uoms.find(u => u.id.toString() === val)?.name
                                            updateLine(index, {
                                                uom: val,
                                                uom_name: uomName
                                            })
                                        }}
                                        uoms={uoms}
                                        showConversionHint={true}
                                        quantity={Number(line.quantity || line.qty) || 1}
                                        label="Unidad"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        step="1"
                                        value={line.unit_cost || 0}
                                        onChange={(e) => updateLine(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                                    />
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {((Number(line.quantity || line.qty) || 0) * (Number(line.unit_cost) || 0)).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                </TableCell>
                                <TableCell>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveLine(index)}
                                        disabled={orderLines.length === 1}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {orderLines.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                    No hay productos seleccionados.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

        </div>
    )
}
