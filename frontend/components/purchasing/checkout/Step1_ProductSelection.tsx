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
import { Plus, Trash2 } from "lucide-react"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"
import api from "@/lib/api"
import { toast } from "sonner"
import { PricingUtils } from "@/lib/pricing"

interface Step1_ProductSelectionProps {
    orderLines: any[]
    setOrderLines: (lines: any[] | ((prev: any[]) => any[])) => void
}

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"

export function Step1_ProductSelection({ orderLines, setOrderLines }: Step1_ProductSelectionProps) {
    const [products, setProducts] = useState<any[]>([])
    const [uoms, setUoMs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [productsRes, uomsRes] = await Promise.all([
                    api.get('/inventory/products/'),
                    api.get('/inventory/uoms/'),
                ])

                // Filter products to exclude SERVICE, MANUFACTURABLE_STANDARD, and MANUFACTURABLE_CUSTOM
                const allProducts = productsRes.data.results || productsRes.data
                const allowedTypes = ['STORABLE', 'CONSUMABLE', 'SERVICE']
                const filteredProducts = allProducts.filter((p: any) => allowedTypes.includes(p.product_type))

                setProducts(filteredProducts)
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
                uom_name: uoms.find(u => u.id.toString() === ((product.purchase_uom || product.uom)?.toString()))?.name
            })
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
                <h3 className="text-lg font-medium">Selección de Productos</h3>
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
                            <TableHead className="w-[35%]">Producto</TableHead>
                            <TableHead className="w-[10%]">Cantidad</TableHead>
                            <TableHead className="w-[20%]">
                                <div className="flex items-center gap-1">
                                    Unidad
                                    <TooltipProvider delayDuration={0}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent className="text-[11px] font-medium">
                                                Las unidades se convierten automáticamente a la unidad base de stock. Pase sobre el icono para ver la equivalencia.
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </TableHead>
                            <TableHead className="w-[15%]">Costo Unit.</TableHead>
                            <TableHead className="w-[10%]">Subtotal</TableHead>
                            <TableHead className="w-[10%]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orderLines.map((line, index) => (
                            <TableRow key={index}>
                                <TableCell>
                                    <ProductSelector
                                        value={line.product?.toString() || line.id?.toString() || ""}
                                        allowedTypes={['STORABLE', 'CONSUMABLE', 'SERVICE']}
                                        context="purchase"
                                        onChange={(val) => handleProductChange(index, val)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        step="0.01"
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
            <div className="flex justify-end p-4 bg-muted/20 rounded-lg">
                <div className="text-right space-y-1">
                    <div className="text-sm text-muted-foreground">
                        Subtotal: {orderLines.reduce((sum, line) => sum + ((Number(line.quantity || line.qty) || 0) * (Number(line.unit_cost) || 0)), 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                        IVA (19%): {orderLines.reduce((sum, line) => {
                            const net = ((Number(line.quantity || line.qty) || 0) * (Number(line.unit_cost) || 0))
                            return sum + PricingUtils.calculateTax(net)
                        }, 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                    </div>
                    <div className="text-xl font-bold">
                        Total: {orderLines.reduce((sum, line) => {
                            const net = ((Number(line.quantity || line.qty) || 0) * (Number(line.unit_cost) || 0))
                            return sum + PricingUtils.netToGross(net)
                        }, 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                    </div>
                </div>
            </div>
        </div>
    )
}
