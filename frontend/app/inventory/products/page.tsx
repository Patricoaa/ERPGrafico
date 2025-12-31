"use client"

import { useEffect, useState } from "react"
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface Product {
    id: number
    code: string
    name: string
    product_type: string
    category_id: number
    category_name: string
    sale_price: string
}

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)

    const fetchProducts = async () => {
        try {
            const response = await api.get('/inventory/products/')
            setProducts(response.data.results || response.data)
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
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Precio Venta</TableHead>
                            <TableHead className="w-[100px] text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.map((product) => (
                            <TableRow key={product.id}>
                                <TableCell className="font-medium">{product.code}</TableCell>
                                <TableCell>{product.name}</TableCell>
                                <TableCell>{product.category_name}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{product.product_type}</Badge>
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
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center">Cargando productos...</TableCell>
                            </TableRow>
                        )}
                        {!loading && products.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center">No hay productos registrados.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
