"use client"

import { showApiError } from "@/lib/errors"
import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ActionConfirmModal, DataTableColumnHeader, DataTableView, EntityCard } from '@/components/shared'
import { DataCell, createActionsColumn } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"
import { CategoryDrawer } from "./CategoryDrawer"

import { toast } from "sonner"

import React from "react"

import { useCategories, type Category } from "@/features/inventory/hooks/useCategories"
import { SmartSearchBar, useClientSearch } from "@/components/shared"
import { categorySearchDef } from "@/features/inventory/searchDef"
import * as LucideIcons from "lucide-react"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"

interface CategoryClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function CategoryClientView({ externalOpen, onExternalOpenChange, createAction }: CategoryClientViewProps) {
    const { categories, isLoading, refetch, deleteCategory } = useCategories()
    const { filterFn, isFiltered } = useClientSearch<Category>(categorySearchDef)
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [isCreateOpen, setIsCreateOpen] = useState(false)  // create modal
    const [isFormOpen, setIsFormOpen] = useState(false)       // CategoryForm (edit)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Category>({
        endpoint: '/inventory/categories'
    })

    // Open edit form if ?selected= is present (ADR-0020).
    // Depends ONLY on selectedFromUrl — NOT on isFormOpen/editingCategory.
    // Reason: clearSelection() calls router.replace() which is async; the URL
    // update arrives one tick later, so selectedFromUrl is still non-null when
    // isFormOpen first flips to false. If we depend on isFormOpen, the effect
    // re-fires and sees (selectedFromUrl=entity, isFormOpen=false) → re-opens
    // the form. Depending only on selectedFromUrl avoids this race.
    useEffect(() => {
        if (selectedFromUrl) {
            requestAnimationFrame(() => {
                setEditingCategory(selectedFromUrl)
                setIsFormOpen(true)
            })
        } else {
            requestAnimationFrame(() => {
                setIsFormOpen(false)
                setEditingCategory(null)
            })
        }
    }, [selectedFromUrl])

    const handleCloseModal = () => {
        setIsFormOpen(false)
        setIsCreateOpen(false)
        setEditingCategory(null)
        onExternalOpenChange?.(false)
        clearSelection()

        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const openSelected = (id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
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
            accessorKey: "id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Código Interno" className="justify-center" />,
            cell: ({ row }) => <DataCell.Code>{row.getValue("id")}</DataCell.Code>,
            size: 80,
        },
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
            cell: ({ row }) => <DataCell.Text>{row.getValue("name")}</DataCell.Text>,
        },
        {
            accessorKey: "parent_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Categoría Padre" className="justify-center" />,
            cell: ({ row }) => <DataCell.Secondary>{row.getValue("parent_name") || "-"}</DataCell.Secondary>,
        },
        createActionsColumn<Category>({
            renderActions: (item) => (
                <>
                    <DataCell.Action action="edit" onClick={() => openSelected(item.id)} />
                    <DataCell.Action action="delete" onClick={() => handleDelete(item)} />
                </>
            ),
        }),
    ], [handleDelete])

    // Sync external trigger (toolbar button) → create modal
    React.useEffect(() => {
        if (externalOpen) requestAnimationFrame(() => setIsCreateOpen(true))
    }, [externalOpen])

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    columns={columns}
                    data={filterFn(categories)}
                    isLoading={isLoading}
                    entityLabel="inventory.category"
                    variant="embedded"
                    smartSearch={<SmartSearchBar searchDef={categorySearchDef} placeholder="Buscar categoría..." className="w-full" />}
                    createAction={createAction}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: "inventory",
                        title: "Aún no hay categorías",
                        description: "Crea categorías para organizar y clasificar tu catálogo de productos.",
                    }}
                    renderCard={(category: Category) => (
                        <EntityCard onClick={() => openSelected(category.id)}>
                            <EntityCard.Header
                                title={category.name}
                                subtitle={category.parent_name ?? 'Categoría raíz'}
                            />
                        </EntityCard>
                    )}
                />
            </div>

            {/* Unified Modal — CategoryDrawer keeps rich selectors + audit for both create and edit */}
            <CategoryDrawer
                onSuccess={() => { void refetch() }}
                open={isFormOpen || isCreateOpen}
                onOpenChange={(open) => {
                    if (!open) { handleCloseModal() }
                    else {
                        if (isCreateOpen) setIsCreateOpen(true)
                        if (isFormOpen) setIsFormOpen(true)
                    }
                }}
                initialData={editingCategory || undefined}
                mode={editingCategory ? "edit" : "create"}
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
