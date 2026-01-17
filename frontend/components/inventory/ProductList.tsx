"use client"

import React, { useEffect, useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { ProductForm } from "@/components/forms/ProductForm"
import { Pencil, Archive, ChevronRight, ChevronDown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { cn, translateProductType } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"
import { PricingUtils } from "@/lib/pricing"

interface Product {
    id: number
    code: string
    internal_code: string
    name: string
    product_type: string
    category_id: number
    category_name: string
    sale_price: string
    current_stock: number
    qty_reserved?: number
    qty_available?: number
    total_stock: number
    manufacturable_quantity?: number | null
    uom_name: string
    purchase_uom_name: string
    track_inventory: boolean
    can_be_sold: boolean
    can_be_purchased: boolean
    active: boolean
}

export function ProductList() {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [showArchived, setShowArchived] = useState(false)

    const fetchProducts = async () => {
        setLoading(true)
        try {
            // If showing archived, we want ALL products (active and archived) to see context,
            // or just active=false? User usually wants to see everything or toggle between modes.
            // Let's use 'all' if showArchived is true, so they see mixed list?
            // Or maybe separate view. Let's send 'all' for now.
            const params = { active: showArchived ? 'all' : undefined }
            const response = await api.get('/inventory/products/', { params })
            const data = response.data.results || response.data
            setProducts(data)
        } catch (error) {
            console.error("Failed to fetch products", error)
            toast.error("Error al cargar los productos.")
        } finally {
            setLoading(false)
        }
    }

    const handleArchive = async (product: Product) => {
        const isArchiving = product.active
        const action = isArchiving ? "archivar" : "restaurar"

        let message = `¿Está seguro de que desea ${action} este producto?`
        if (isArchiving && product.product_type === 'SUBSCRIPTION') {
            message += "\n\nIMPORTANTE: Al archivar este producto, sus suscripciones activas/pausadas se ocultarán del gestor de suscripciones hasta que el producto sea restaurado."
        } else if (!isArchiving && product.product_type === 'SUBSCRIPTION') {
            message += "\n\nAl restaurar el producto, sus suscripciones volverán a aparecer en el gestor central."
        }

        if (!confirm(message)) return

        try {
            await api.patch(`/inventory/products/${product.id}/`, { active: !product.active })
            toast.success(`Producto ${isArchiving ? 'archivado' : 'restaurado'} correctamente.`, {
                description: product.product_type === 'SUBSCRIPTION'
                    ? `Las suscripciones asociadas han sido ${isArchiving ? 'ocultas' : 'restauradas en la lista'}.`
                    : undefined
            })
            fetchProducts()
        } catch (error) {
            console.error(`Error ${action} product:`, error)
            toast.error(`Error al ${action} el producto.`)
        }
    }

    useEffect(() => {
        fetchProducts()
    }, [showArchived])

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Catálogo de Productos</h3>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowArchived(!showArchived)}
                        className={showArchived ? "bg-amber-50 border-amber-200 text-amber-700" : ""}
                    >
                        {showArchived ? "Ocultar Archivados" : "Mostrar Archivados"}
                    </Button>
                    <Button onClick={() => setIsFormOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Producto
                    </Button>
                </div>
            </div>

            <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead>Código Int.</TableHead>
                            <TableHead>SKU/Código</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                            <TableHead className="text-right">Neto</TableHead>
                            <TableHead className="text-right">IVA (19%)</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-center">Atributos</TableHead>
                            <TableHead className="w-[100px] text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.map((product) => (
                            <TableRow key={product.id} className="group hover:bg-muted/20 transition-colors">
                                <TableCell className="font-mono text-[10px] font-bold text-primary">
                                    {product.internal_code}
                                    {!product.active && (
                                        <Badge variant="destructive" className="ml-1 text-[8px] h-3 px-1">ARCHIVADO</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="font-mono text-xs">{product.code || '-'}</TableCell>
                                <TableCell className="font-medium">
                                    <span className={!product.active ? "text-muted-foreground line-through" : ""}>
                                        {product.name}
                                    </span>
                                </TableCell>
                                <TableCell className="text-sm">{product.category_name}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="text-[10px]">{translateProductType(product.product_type)}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-bold tabular-nums">
                                    {product.track_inventory ? (
                                        <div className="flex flex-col items-end gap-0.5 text-[10px]">
                                            <div className="flex gap-2 justify-between w-full min-w-[80px]">
                                                <span className="text-muted-foreground font-normal">Físico:</span>
                                                <span>{product.current_stock || 0}</span>
                                            </div>
                                            {(product.qty_reserved || 0) > 0 && (
                                                <div className="flex gap-2 justify-between w-full min-w-[80px] text-amber-600">
                                                    <span className="font-normal">Reserv:</span>
                                                    <span>{product.qty_reserved}</span>
                                                </div>
                                            )}
                                            <div className="flex gap-2 justify-between w-full min-w-[80px] border-t border-dashed pt-0.5 mt-0.5">
                                                <span className="text-emerald-600 font-bold">Disp:</span>
                                                <span className="text-emerald-600 font-bold">{product.qty_available || 0}</span>
                                            </div>
                                            <span className="text-[9px] text-muted-foreground font-normal mt-0.5">{product.uom_name}</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-end">
                                            {product.product_type === 'MANUFACTURABLE' ? (
                                                <div className="flex flex-col items-end gap-0.5">
                                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-200 bg-blue-50 text-blue-700 h-4">Fabricable</Badge>
                                                    <span className="text-[10px] text-blue-600 font-medium">
                                                        {product.manufacturable_quantity !== null && product.manufacturable_quantity !== undefined
                                                            ? `${product.manufacturable_quantity} disp.`
                                                            : 'Disponible'}
                                                    </span>
                                                </div>
                                            ) : product.product_type === 'SERVICE' ? (
                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-200 bg-emerald-50 text-emerald-700 h-4">Disponible</Badge>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground font-normal">No controlado</span>
                                            )}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="text-right font-bold text-muted-foreground">
                                    {formatCurrency(product.sale_price)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground text-xs">
                                    {formatCurrency(PricingUtils.calculateTax(Number(product.sale_price)))}
                                </TableCell>
                                <TableCell className="text-right font-bold text-primary">
                                    {formatCurrency(PricingUtils.netToGross(Number(product.sale_price)))}
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-center gap-1">
                                        {product.can_be_sold && (
                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-200 bg-emerald-50 text-emerald-700 h-4">Venta</Badge>
                                        )}
                                        {product.can_be_purchased && (
                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-200 bg-blue-50 text-blue-700 h-4">Compra</Badge>
                                        )}
                                        {!product.can_be_sold && !product.can_be_purchased && (
                                            <span className="text-[10px] text-muted-foreground italic">Ninguno</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => { setEditingProduct(product); setIsFormOpen(true); }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn("h-8 w-8", product.active ? "text-destructive" : "text-emerald-600")}
                                            onClick={() => handleArchive(product)}
                                            title={product.active ? "Archivar" : "Restaurar"}
                                        >
                                            {product.active ? <Archive className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow><TableCell colSpan={7} className="text-center py-10">Cargando productos...</TableCell></TableRow>
                        )}
                        {!loading && products.length === 0 && (
                            <TableRow><TableCell colSpan={7} className="text-center py-10 italic text-muted-foreground">No hay productos registrados.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <ProductForm
                open={isFormOpen}
                onOpenChange={(open) => {
                    setIsFormOpen(open)
                    if (!open) setEditingProduct(null)
                }}
                initialData={editingProduct}
                onSuccess={fetchProducts}
            />
        </div >
    )
}
