"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { ColumnDef } from "@tanstack/react-table"
import api from "@/lib/api"
import { CategoryForm } from "./CategoryForm"
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

interface CategoryListProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
}

export function CategoryList({ externalOpen, onExternalOpenChange }: CategoryListProps) {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleCloseModal = () => {
        setIsFormOpen(false)
        setEditingCategory(null)
        onExternalOpenChange?.(false)
        
        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const fetchCategories = useCallback(async () => {
        try {
            const response = await api.get('/inventory/categories/')
            setCategories(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch categories", error)
            toast.error("Error al cargar las categorías.")
        } finally {
            setLoading(false)
        }
    }, [])

    const handleDelete = useCallback(async (category: Category | null, isConfirmed = false) => {
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
    }, [fetchCategories])

    useEffect(() => {
        fetchCategories()
    }, [fetchCategories])

    const columns = useMemo<ColumnDef<Category>[]>(() => [
        {
            id: "icon",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Icono" className="justify-center" />,
            cell: ({ row }) => {
                const iconName = row.original.icon
                if (!iconName) return <div className="flex justify-center w-full">-</div>
                return (
                    <div className="flex items-center justify-center w-full">
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/30 border border-muted-foreground/10 transition-colors">
                            {(() => {
                                const Icon = (LucideIcons as any)[iconName] || LucideIcons.Package
                                return <Icon className="h-4 w-4 text-muted-foreground/70" />
                            })()}
                        </div>
                    </div>
                )
            },
        },
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }) => <DataCell.Text className="text-[12px] font-black uppercase text-center w-full">{row.getValue("name")}</DataCell.Text>,
        },
        {
            accessorKey: "parent_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Categoría Padre" className="justify-center" />,
            cell: ({ row }) => <DataCell.Secondary className="text-[10px] uppercase font-bold text-muted-foreground opacity-60 text-center w-full">{row.getValue("parent_name") || "-"}</DataCell.Secondary>,
        },
        createActionsColumn<Category>({
            renderActions: (item) => (
                <>
                    <DataCell.Action icon={Pencil} title="Editar" onClick={() => { setEditingCategory(item); setIsFormOpen(true) }} />
                    <DataCell.Action icon={Trash2} title="Eliminar" className="text-destructive" onClick={() => handleDelete(item)} />
                </>
            ),
        }),
    ], [handleDelete])


    const globalFilterFields = useMemo(() => ["name", "parent_name"], [])

    return (
        <div className="space-y-4">
            <DataTable
                columns={columns}
                data={categories}
                cardMode
                isLoading={loading}
                searchPlaceholder="Buscar categoría por nombre..."
                globalFilterFields={globalFilterFields}
                useAdvancedFilter={true}
            />

            <CategoryForm
                onSuccess={fetchCategories}
                open={isFormOpen || !!externalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCloseModal()
                    } else {
                        setIsFormOpen(true)
                    }
                }}
                initialData={editingCategory || undefined}
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
