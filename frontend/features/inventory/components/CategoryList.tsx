"use client"

import { showApiError } from "@/lib/errors"

import { useState, useMemo, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { ColumnDef } from "@tanstack/react-table"

import { CategoryForm } from "./CategoryForm"
import { BaseModal } from "@/components/shared/BaseModal"
import { Pencil, Trash2 } from "lucide-react"

import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import React from "react"

import { useCategories, type Category } from "@/features/inventory/hooks/useCategories"
import * as LucideIcons from "lucide-react"

interface CategoryListProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function CategoryList({ externalOpen, onExternalOpenChange, createAction }: CategoryListProps) {
    const { categories, refetch, deleteCategory } = useCategories()
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [isCreateOpen, setIsCreateOpen] = useState(false)  // EntityForm modal
    const [isFormOpen, setIsFormOpen] = useState(false)       // CategoryForm (edit)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleCloseModal = () => {
        setIsFormOpen(false)
        setIsCreateOpen(false)
        setEditingCategory(null)
        onExternalOpenChange?.(false)

        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const handleDelete = useCallback(async (category: Category | null, isConfirmed = false) => {
        if (!category) return

        if (!isConfirmed) {
            setCategoryToDelete(category)
            setIsDeleteModalOpen(true)
            return
        }

        try {
            await deleteCategory(category.id)
            toast.success("Categoría eliminada correctamente.")
            setIsDeleteModalOpen(false)
        } catch (error) {
            console.error("Error deleting category:", error)
            showApiError(error, "Error al eliminar la categoría.")
        }
    }, [deleteCategory])

    const columns = useMemo<ColumnDef<Category>[]>(() => [
        {
            id: "icon",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Icono" className="justify-center" />,
            cell: ({ row }) => {
                const iconName = row.original.icon
                if (!iconName) return <div className="flex justify-center w-full">-</div>
                return (
                    <div className="flex items-center justify-center w-full">
                        <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted/30 border border-muted-foreground/10 transition-colors">
                            {(() => {
                                const Icon = (LucideIcons as unknown as Record<string, React.ElementType>)[iconName] ?? LucideIcons.Package
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

    // Sync external trigger (toolbar button) → create modal (EntityForm)
    React.useEffect(() => {
        if (externalOpen) setIsCreateOpen(true)
    }, [externalOpen])


    const globalFilterFields = useMemo(() => ["name", "parent_name"], [])

    return (
        <div className="space-y-4">
            <DataTable
                columns={columns}
                data={categories}
                cardMode

                searchPlaceholder="Buscar categoría por nombre..."
                globalFilterFields={globalFilterFields}
                useAdvancedFilter={true}
                createAction={createAction}
            />

            {/* Unified Modal — CategoryForm keeps rich selectors + audit for both create and edit */}
            <CategoryForm
                onSuccess={() => { void refetch(); handleCloseModal() }}
                open={isFormOpen || isCreateOpen}
                onOpenChange={(open) => {
                    if (!open) handleCloseModal()
                    else {
                        if (isCreateOpen) setIsCreateOpen(true)
                        if (isFormOpen) setIsFormOpen(true)
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
