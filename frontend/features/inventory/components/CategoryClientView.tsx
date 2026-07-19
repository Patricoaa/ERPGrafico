"use client"

import { showApiError } from "@/lib/errors"
import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ActionConfirmModal, DataTableColumnHeader, DataTableView, AutoEntityCard } from '@/components/shared'
import { UnifiedSearchBar, useUnifiedSearch } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { CategoryDrawer } from "./CategoryDrawer"
import { categoryActions, type CategoryActionsCtx } from "@/features/inventory/categoryActions"
import { categoryFields } from "../categoryFields"

import { toast } from "sonner"

import React from "react"

import { useCategories, type Category } from "@/features/inventory/hooks/useCategories"
import { categoryUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import * as LucideIcons from "lucide-react"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"

interface CategoryClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function CategoryClientView({ externalOpen, onExternalOpenChange, createAction }: CategoryClientViewProps) {
    const { categories, isLoading, refetch, deleteCategory } = useCategories()
    const search = useUnifiedSearch(categoryUnifiedSearchDef)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)

    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Category>({
        endpoint: '/inventory/categories'
    })
    const { openSelected } = useEntityRouteActions()

    const isCreateOpen = searchParams.get("modal") === "new" || externalOpen
    const isEditOpen = !!selectedFromUrl
    const drawerOpen = Boolean(isCreateOpen || isEditOpen)

    const handleCloseModal = (open: boolean = false) => {
        if (!open) {
            onExternalOpenChange?.(false)
            if (isEditOpen) clearSelection()
            if (isCreateOpen) {
                const params = new URLSearchParams(searchParams.toString())
                params.delete("modal")
                router.replace(`${pathname}?${params.toString()}`, { scroll: false })
            }
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

    const actionsCtx: CategoryActionsCtx = {
        onEdit: (id) => openSelected(id),
        onDelete: (category) => handleDelete(category),
    }

    const columns = useMemo<ColumnDef<Category>[]>(() => {
        const [idCol, nameCol, parentCol] = categoryFields.toColumns()
        return [
            idCol,
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
            nameCol,
            parentCol,
            categoryActions.auto(actionsCtx),
        ]
    }, [actionsCtx])



    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    columns={columns}
                    data={search.filterFn(categories)}
                    isLoading={isLoading}
                    entityLabel="inventory.category"
                    variant="embedded"
                    unifiedSearch={<UnifiedSearchBar
                        config={categoryUnifiedSearchDef}
                        chips={search.chips}
                        isFiltered={search.isFiltered}
                        inputValue={search.inputValue}
                        onInputChange={search.setInputValue}
                        onApply={search.applyFilter}
                        onRemove={search.removeFilter}
                        onClearAll={search.clearAll}
                        groupBy={search.groupBy}
                        onGroupBySelect={search.setGroupBy}
                        paramValues={search.paramValues}
                        placeholder="Buscar categoría..."
                    />}
                    unifiedSearchConfig={categoryUnifiedSearchDef}
                    currentGroupBy={search.groupBy}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    createAction={createAction}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "inventory",
                        title: "Aún no hay categorías",
                        description: "Crea categorías para organizar y clasificar tu catálogo de productos.",
                    }}
                    renderCard={(category: Category) => (
                        <AutoEntityCard
                            key={category.id}
                            data={category}
                            fields={categoryFields}
                            entityLabel="inventory.category"
                            title={category.name}
                            actions={categoryActions.render(category, actionsCtx)}
                            defaultAction={categoryActions.defaultAction(actionsCtx)?.(category) ?? (() => openSelected(category.id))}

                        />
                    )}
                />
            </div>

            {/* Unified Modal — CategoryDrawer keeps rich selectors + audit for both create and edit */}
            <CategoryDrawer
                onSuccess={() => { void refetch() }}
                open={drawerOpen}
                onOpenChange={handleCloseModal}
                initialData={selectedFromUrl || undefined}
                // mode is handled internally by CategoryDrawer via useDrawerMode
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
