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
import { Pencil, Trash2, ChevronRight, ChevronDown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { cn, translateProductType } from "@/lib/utils"

interface Product {
    id: number
    code: string
    name: string
    product_type: string
    category_id: number
    category_name: string
    sale_price: string
    current_stock: number
    total_stock: number
    uom_name: string
    purchase_uom_name: string
    track_inventory: boolean
}

export function ProductList() {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)

    const fetchProducts = async () => {
        setLoading(true)
        try {
            const response = await api.get('/inventory/products/')
            const data = response.data.results || response.data
            setProducts(data)
        } catch (error) {
            console.error("Failed to fetch products", error)
            toast.error("Error al cargar los productos.")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de que desea eliminar este producto?")) return
        try {
            await api.delete(`/inventory/products/${id}/`)
            toast.success("Producto eliminado correctamente.")
            fetchProducts()
        } catch (error) {
            console.error("Error deleting product:", error)
            toast.error("Error al eliminar el producto.")
        }
    }

    useEffect(() => {
        fetchProducts()
    }, [])

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Catálogo de Productos</h3>
                <Button onClick={() => setIsFormOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Nuevo Producto
                </Button>
            </div>

            <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                            <TableHead className="text-right">Precio</TableHead>
                            <TableHead className="w-[100px] text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.map((product) => (
                            <TableRow key={product.id} className="group hover:bg-muted/20 transition-colors">
                                <TableCell className="font-mono text-xs">{product.code}</TableCell>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell className="text-sm">{product.category_name}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="text-[10px]">{translateProductType(product.product_type)}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-bold tabular-nums">
                                    {product.track_inventory ? (
                                        <>
                                            {product.total_stock} <span className="text-[10px] text-muted-foreground font-normal">{product.uom_name}</span>
                                        </>
                                    ) : (
                                        <span className="text-[10px] text-muted-foreground font-normal">No controlado</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right font-bold text-primary">
                                    ${Number(product.sale_price).toLocaleString()}
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
                                            className="h-8 w-8 text-destructive"
                                            onClick={() => handleDelete(product.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
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
        </div>
    )
}
