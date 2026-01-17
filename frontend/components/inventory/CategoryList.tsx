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

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Categorías de Productos</h3>
                <Button onClick={() => setIsFormOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Nueva Categoría
                </Button>
            </div>

            <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead className="w-[50px]">Icono</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Categoría Padre</TableHead>
                            <TableHead className="w-[100px] text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {categories.map((category) => (
                            <TableRow key={category.id} className="group hover:bg-muted/20 transition-colors">
                                <TableCell>
                                    {category.icon && (
                                        <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted/50">
                                            {(() => {
                                                const Icon = (LucideIcons as any)[category.icon] || LucideIcons.Package
                                                return <Icon className="h-4 w-4 text-muted-foreground" />
                                            })()}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="font-medium">{category.name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{category.parent_name || "-"}</TableCell>
                                <TableCell>
                                    <div className="flex justify-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
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
                                            className="h-8 w-8 text-destructive"
                                            onClick={() => handleDelete(category)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow><TableCell colSpan={3} className="text-center py-10">Cargando categorías...</TableCell></TableRow>
                        )}
                        {!loading && categories.length === 0 && (
                            <TableRow><TableCell colSpan={3} className="text-center py-10 italic text-muted-foreground">No hay categorías registradas.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

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
