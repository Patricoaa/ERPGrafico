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
    variant_of: number | null
    variants_count: number
    attribute_values: any[]
    uom_name: string
    purchase_uom_name: string
}

export function ProductList() {
    const [allProducts, setAllProducts] = useState<Product[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

    // Filtering State
    const [attributes, setAttributes] = useState<any[]>([])
    const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({})

    const fetchAttributes = async () => {
        try {
            const res = await api.get('/inventory/attributes/')
            setAttributes(res.data.results || res.data)
        } catch (error) {
            console.error("Error fetching attributes", error)
        }
    }

    const fetchProducts = async () => {
        setLoading(true)
        try {
            let url = '/inventory/products/?'
            Object.entries(selectedFilters).forEach(([key, value]) => {
                if (value) url += `attribute_value=${value}&`
            })

            const response = await api.get(url)
            const data = response.data.results || response.data
            setAllProducts(data)

            if (Object.keys(selectedFilters).length > 0) {
                setProducts(data)
            } else {
                setProducts(data.filter((p: Product) => p.variant_of === null))
            }
        } catch (error) {
            console.error("Failed to fetch products", error)
            toast.error("Error al cargar los productos.")
        } finally {
            setLoading(false)
        }
    }

    const toggleFilter = (attrName: string, value: string) => {
        const newFilters = { ...selectedFilters }
        if (newFilters[attrName] === value) {
            delete newFilters[attrName]
        } else {
            newFilters[attrName] = value
        }
        setSelectedFilters(newFilters)
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
        fetchAttributes()
        fetchProducts()
    }, [])

    useEffect(() => {
        fetchProducts()
    }, [selectedFilters])

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Catálogo de Productos</h3>
                <Button onClick={() => setIsFormOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Nuevo Producto
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[200px,1fr] gap-6">
                <aside className="space-y-4">
                    <div className="rounded-xl border p-4 bg-muted/5">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Filtros</h4>
                            {Object.keys(selectedFilters).length > 0 && (
                                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setSelectedFilters({})}>Limpiar</Button>
                            )}
                        </div>
                        <div className="space-y-6">
                            {attributes.map((attr) => (
                                <div key={attr.id} className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground/70">{attr.name}</Label>
                                    <div className="flex flex-wrap gap-1">
                                        {attr.values.map((val: any) => {
                                            const isSelected = selectedFilters[attr.name] === val.value
                                            return (
                                                <Badge
                                                    key={val.id}
                                                    variant={isSelected ? "default" : "outline"}
                                                    className={cn("cursor-pointer text-[10px] px-2 py-0 h-6 transition-all", isSelected && "ring-2 ring-primary ring-offset-1")}
                                                    onClick={() => toggleFilter(attr.name, val.value)}
                                                >
                                                    {val.value}
                                                </Badge>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

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
                                        {product.total_stock} <span className="text-[10px] text-muted-foreground font-normal">{product.uom_name}</span>
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
