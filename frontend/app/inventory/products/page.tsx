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
import { Pencil, Trash2, MoreHorizontal } from "lucide-react"
import { DataManagement } from "@/components/shared/DataManagement"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { cn, translateProductType } from "@/lib/utils"

import { ChevronRight, ChevronDown } from "lucide-react"
import { AttributeBadges } from "@/components/shared/AttributeBadges"

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
}

export default function ProductsPage() {
    const [allProducts, setAllProducts] = useState<Product[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

    // Phase C: Filtering State
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

            // If filtering by attribute, we might want to show variants directly 
            // but for now, let's keep the parent view if no filters
            if (Object.keys(selectedFilters).length > 0) {
                setProducts(data) // Show all matches
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

    useEffect(() => {
        fetchAttributes()
    }, [])

    useEffect(() => {
        fetchProducts()
    }, [selectedFilters])

    const toggleRow = (id: number) => {
        const newExpanded = new Set(expandedRows)
        if (newExpanded.has(id)) {
            newExpanded.delete(id)
        } else {
            newExpanded.add(id)
        }
        setExpandedRows(newExpanded)
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

    const getVariants = (parentId: number) => {
        return allProducts.filter(p => p.variant_of === parentId)
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Catálogo de Productos</h2>
                <div className="flex items-center space-x-2">
                    <ProductForm
                        onSuccess={fetchProducts}
                        open={isFormOpen && !editingProduct}
                        onOpenChange={(open) => {
                            setIsFormOpen(open)
                            if (!open) setEditingProduct(null)
                        }}
                    />
                    {editingProduct && (
                        <ProductForm
                            initialData={editingProduct}
                            open={isFormOpen && !!editingProduct}
                            onOpenChange={(open) => {
                                setIsFormOpen(open)
                                if (!open) setEditingProduct(null)
                            }}
                            onSuccess={fetchProducts}
                        />
                    )}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[250px,1fr] gap-6">
                <div className="space-y-4">
                    <div className="rounded-md border p-4 bg-muted/10">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-sm">Filtros de Atributos</h3>
                            {Object.keys(selectedFilters).length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-[10px]"
                                    onClick={() => setSelectedFilters({})}
                                >
                                    Limpiar
                                </Button>
                            )}
                        </div>
                        <div className="space-y-4">
                            {attributes.map((attr) => (
                                <div key={attr.id} className="space-y-2">
                                    <Label className="text-[11px] uppercase text-muted-foreground font-bold">{attr.name}</Label>
                                    <div className="flex flex-wrap gap-1">
                                        {attr.values.map((val: any) => {
                                            const isSelected = selectedFilters[attr.name] === val.value
                                            return (
                                                <Badge
                                                    key={val.id}
                                                    variant={isSelected ? "default" : "outline"}
                                                    className={cn(
                                                        "cursor-pointer text-[10px] py-0 px-2 h-6 hover:opacity-80 transition-all",
                                                        isSelected && "ring-2 ring-primary ring-offset-1"
                                                    )}
                                                    onClick={() => toggleFilter(attr.name, val.value)}
                                                >
                                                    {val.value}
                                                </Badge>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                            {attributes.length === 0 && (
                                <p className="text-xs text-muted-foreground italic">No hay atributos definidos</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px]"></TableHead>
                                <TableHead>Código</TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Categoría</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead className="text-right">Stock</TableHead>
                                <TableHead className="text-right">Precio Venta</TableHead>
                                <TableHead className="w-[100px] text-center">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {products.map((product) => {
                                const isExpanded = expandedRows.has(product.id)
                                const variants = getVariants(product.id)
                                const hasVariants = product.variants_count > 0

                                return (
                                    <React.Fragment key={product.id}>
                                        <TableRow className={hasVariants ? "bg-muted/30" : ""}>
                                            <TableCell>
                                                {hasVariants && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => toggleRow(product.id)}
                                                    >
                                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                    </Button>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">{product.code}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span>{product.name}</span>
                                                    {hasVariants && (
                                                        <span className="text-[10px] text-muted-foreground font-medium uppercase">
                                                            {product.variants_count} variantes
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{product.category_name}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{translateProductType(product.product_type)}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-bold">{product.total_stock}</span>
                                                    {hasVariants && (
                                                        <span className="text-[10px] text-muted-foreground">Total Variantes</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">${Number(product.sale_price).toLocaleString()}</TableCell>
                                            <TableCell>
                                                <div className="flex justify-center space-x-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            setEditingProduct(product)
                                                            setIsFormOpen(true)
                                                        }}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={() => handleDelete(product.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        {isExpanded && variants.map((variant) => (
                                            <TableRow key={variant.id} className="bg-muted/10">
                                                <TableCell></TableCell>
                                                <TableCell className="pl-8 text-muted-foreground font-mono text-xs">{variant.code}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm">{variant.name}</span>
                                                        <AttributeBadges attributes={variant.attribute_values} />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">{variant.category_name}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-[10px]">{variant.product_type}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right text-sm font-medium">{variant.current_stock}</TableCell>
                                                <TableCell className="text-right text-sm">${Number(variant.sale_price).toLocaleString()}</TableCell>
                                                <TableCell>
                                                    <div className="flex justify-center space-x-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => {
                                                                setEditingProduct(variant)
                                                                setIsFormOpen(true)
                                                            }}
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                                            onClick={() => handleDelete(variant.id)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </React.Fragment>
                                )
                            })}
                            {loading && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center">Cargando productos...</TableCell>
                                </TableRow>
                            )}
                            {!loading && products.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center">No hay productos registrados.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
