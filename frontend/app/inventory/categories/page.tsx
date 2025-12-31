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
import { CategoryForm } from "@/components/forms/CategoryForm"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface Category {
    id: number
    name: string
    parent: number | null
    parent_name: string | null
    asset_account: number | null
    income_account: number | null
    expense_account: number | null
}

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)

    const fetchCategories = async () => {
        try {
            const response = await api.get('/inventory/categories/')
            setCategories(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch categories", error)
            toast.error("Error al cargar las categorías.")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de que desea eliminar esta categoría?")) return
        try {
            await api.delete(`/inventory/categories/${id}/`)
            toast.success("Categoría eliminada correctamente.")
            fetchCategories()
        } catch (error) {
            console.error("Error deleting category:", error)
            toast.error("Error al eliminar la categoría.")
        }
    }

    useEffect(() => {
        fetchCategories()
    }, [])

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Categorías de Productos</h2>
                <div className="flex items-center space-x-2">
                    <CategoryForm
                        onSuccess={fetchCategories}
                        open={isFormOpen && !editingCategory}
                        onOpenChange={(open) => {
                            setIsFormOpen(open)
                            if (!open) setEditingCategory(null)
                        }}
                    />
                    {editingCategory && (
                        <CategoryForm
                            initialData={editingCategory}
                            open={isFormOpen && !!editingCategory}
                            onOpenChange={(open) => {
                                setIsFormOpen(open)
                                if (!open) setEditingCategory(null)
                            }}
                            onSuccess={fetchCategories}
                        />
                    )}
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Categoría Padre</TableHead>
                            <TableHead className="w-[100px] text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {categories.map((category) => (
                            <TableRow key={category.id}>
                                <TableCell className="font-medium">{category.name}</TableCell>
                                <TableCell>{category.parent_name || "-"}</TableCell>
                                <TableCell>
                                    <div className="flex justify-center space-x-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                setEditingCategory(category)
                                                setIsFormOpen(true)
                                            }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(category.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center">Cargando categorías...</TableCell>
                            </TableRow>
                        )}
                        {!loading && categories.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center">No hay categorías registradas.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
