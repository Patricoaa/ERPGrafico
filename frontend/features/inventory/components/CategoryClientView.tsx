"use client"

import { showApiError } from "@/lib/errors"
import React, { useCallback, useMemo, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ActionConfirmModal, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { categoryActions, type CategoryActionsCtx } from "@/features/inventory/categoryActions"
import { useCategories, type Category } from "@/features/inventory/hooks/useCategories"
import { categoryUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { categoryEntity, categoryViews } from "../entity-view/category.entity"
import { CategoryDrawer } from "./CategoryDrawer"

interface CategoryClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function CategoryClientView({ externalOpen, onExternalOpenChange, createAction }: CategoryClientViewProps) {
    const { categories, isLoading, isRefetching, isError, refetch, deleteCategory } = useCategories()
    const search = useUnifiedSearch(categoryUnifiedSearchDef)
    const { filterFn } = search
    const { view, onViewChange } = useCollectionViewMode("inventory.category")
    const rows = useMemo(() => filterFn(categories), [filterFn, categories])
    const collection = useEntityCollection(
        categoryEntity,
        { rows, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        { defaultSort: categoryViews.table.defaultSort },
    )
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

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                onOpen={(category) => openSelected(category.id)}
                actions={categoryActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar
                        config={categoryUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar categoría..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={categoryViews.table}
                    card={categoryViews.card}
                    emptyTitle="Aún no hay categorías"
                    emptyDescription="Crea categorías para organizar y clasificar tu catálogo de productos."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

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
