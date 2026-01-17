"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import api from "@/lib/api"
import { CategoryForm } from "@/components/forms/CategoryForm"
import { Pencil, Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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

    const columns: ColumnDef<Category>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre" />
            ),
            cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
        },
        {
            accessorKey: "parent_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Categoría Padre" />
            ),
            cell: ({ row }) => <div>{row.getValue("parent_name") || "-"}</div>,
        },
        {
            id: "actions",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Acciones" className="text-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center space-x-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            setEditingCategory(row.original)
                            setIsFormOpen(true)
                        }}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(row.original.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Categorías de Productos</h2>
                <Button onClick={() => setIsFormOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nueva Categoría
                </Button>
            </div>

            <div className="hidden">
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
            <div className="rounded-md border">
                <DataTable columns={columns} data={categories} />
            </div>
        </div>
    )
}
