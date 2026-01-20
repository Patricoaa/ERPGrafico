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
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

interface Category {
    id: number
    name: string
    parent: number | null
    parent_name: string | null
    asset_account: number | null
    income_account: number | null
    expense_account: number | null
    icon?: string
}

import * as LucideIcons from "lucide-react"

export function CategoryList() {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)

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

    const handleDelete = async (category: Category | null, isConfirmed = false) => {
        if (!category) return

        if (!isConfirmed) {
            setCategoryToDelete(category)
            setIsDeleteModalOpen(true)
            return
        }

        try {
            await api.delete(`/inventory/categories/${category.id}/`)
            toast.success("Categoría eliminada correctamente.")
            setIsDeleteModalOpen(false)
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
            id: "icon",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Icono" />,
            cell: ({ row }) => {
                const iconName = row.original.icon
                if (!iconName) return null
                return (
                    <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted/50">
                        {(() => {
                            const Icon = (LucideIcons as any)[iconName] || LucideIcons.Package
                            return <Icon className="h-4 w-4 text-muted-foreground" />
                        })()}
                    </div>
                )
            },
        },
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
            cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
        },
        {
            accessorKey: "parent_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Categoría Padre" />,
            cell: ({ row }) => <div className="text-sm text-muted-foreground">{row.getValue("parent_name") || "-"}</div>,
        },
        {
            id: "actions",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Acciones" className="text-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingCategory(row.original); setIsFormOpen(true) }}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(row.original)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="space-y-4">
            <DataTable
                columns={columns}
                data={categories}
                filterColumn="name"
                searchPlaceholder="Buscar categoría..."
                globalFilterFields={["name", "parent_name"]}
                useAdvancedFilter={true}
                toolbarAction={
                    <Button onClick={() => setIsFormOpen(true)} size="sm">
                        <Plus className="mr-2 h-4 w-4" /> Nueva Categoría
                    </Button>
                }
            />

            <CategoryForm
                onSuccess={fetchCategories}
                open={isFormOpen}
                onOpenChange={(open) => {
                    setIsFormOpen(open)
                    if (!open) setEditingCategory(null)
                }}
                initialData={editingCategory}
            />

            <ActionConfirmModal
                open={isDeleteModalOpen}
                onOpenChange={setIsDeleteModalOpen}
                title="Eliminar Categoría"
                variant="destructive"
                onConfirm={() => { if (categoryToDelete) return handleDelete(categoryToDelete, true) }}
                confirmText="Eliminar"
                description={
                    <p>
                        ¿Está seguro de que desea eliminar la categoría <strong>{categoryToDelete?.name}</strong>?
                        Esta acción no se puede deshacer y puede afectar a los productos asociados.
                    </p>
                }
            />
        </div>
    )
}
