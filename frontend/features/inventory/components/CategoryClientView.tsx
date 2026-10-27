"use client"

import { EntityPanelTab } from "@/components/providers"
import { showApiError } from "@/lib/errors"
import React, { useMemo } from "react"

import { Archive, ArchiveRestore } from "lucide-react"
import { toast } from "sonner"
import { ActionConfirmModal, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch, type BulkAction } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { categoryActions, type CategoryActionsCtx } from "@/features/inventory/categoryActions"
import { useCategories, type Category } from "@/features/inventory/hooks/useCategories"
import { categoryUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { categoryEntity, categoryViews } from "../entity-view/category.entity"
import { CategoryDrawer } from "./CategoryDrawer"

interface CategoryClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function CategoryClientView({ externalOpen, onExternalOpenChange, createAction }: CategoryClientViewProps) {
    const { categories, isLoading, isRefetching, isError, refetch, archiveCategory } = useCategories()
    const search = useUnifiedSearch(categoryUnifiedSearchDef)
    const { filterFn } = search
    const { view, onViewChange } = useCollectionViewMode("inventory.category")
    const rows = useMemo(() => filterFn(categories), [filterFn, categories])
    // Rows are filtered here: a failed refetch with cached data must read "no results", not "error".
    const collection = useEntityCollection(
        categoryEntity,
        { rows, isLoading, isRefetching, error: isError && categories.length === 0, refetch, isFiltered: search.isFiltered },
        { defaultSort: categoryViews.table.defaultSort },
    )

    const panel = useEntityPanelRoute<Category>({ endpoint: '/inventory/categories', external: { open: externalOpen, onOpenChange: onExternalOpenChange } })
    const selectedFromUrl = panel.entity
    const { openSelected } = useEntityRouteActions()

    const archiveConfirm = useConfirmAction<Category>(async (category) => {
        const isArchiving = category.is_active
        try {
            await archiveCategory({ id: category.id, is_active: !category.is_active })
            toast.success(`Categoría ${isArchiving ? "archivada" : "restaurada"} correctamente`)
        } catch (error) {
            showApiError(error, `No se puede ${isArchiving ? "archivar" : "restaurar"} la categoría`)
        }
   })

    const bulkArchiveConfirm = useConfirmAction<Category[]>(async (items) => {
        const isArchiving = items.every(c => c.is_active)
        try {
            await Promise.all(items.map(c => archiveCategory({ id: c.id, is_active: !isArchiving })))
            toast.success(`${items.length} categorías ${isArchiving ? "archivadas" : "restauradas"}`)
        } catch (error) {
            showApiError(error, `Error al ${isArchiving ? "archivar" : "restaurar"} las categorías`)
            throw error
        }
   })

    const actionsCtx: CategoryActionsCtx = {
        onEdit: (id) => openSelected(id),
        onArchive: (category) => archiveConfirm.requestConfirm(category),
    }

    const bulkActions = useMemo<BulkAction<Category>[]>(() => [
        {
            key: "restore",
            label: "Restaurar",
            icon: ArchiveRestore,
            intent: "success",
            hidden: (items) => items.length === 0 || !items.every(c => !c.is_active),
            onClick: async (items) => bulkArchiveConfirm.requestConfirm(items),
        },
        {
            key: "archive",
            label: "Archivar",
            icon: Archive,
            intent: "destructive",
            hidden: (items) => items.length === 0 || !items.every(c => c.is_active),
            onClick: async (items) => bulkArchiveConfirm.requestConfirm(items),
        },
    ], [bulkArchiveConfirm])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                selection="bulk"
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
                <Collection.BulkBar actions={bulkActions} />
            </Collection.Root>

            {/* Unified Modal — CategoryDrawer keeps rich selectors + audit for both create and edit */}
            <EntityPanelTab label="inventory.category" {...panel.tab}>
                {(open) => (
                    <CategoryDrawer
                        onSuccess={() => { void refetch() }}
                        open={open}
                        onOpenChange={(open) => { if (!open) panel.close() }}
                        initialData={selectedFromUrl || undefined}
                        // mode is handled internally by CategoryDrawer via useDrawerMode
                    />
                )}
            </EntityPanelTab>

            <ActionConfirmModal
                open={archiveConfirm.isOpen}
                onOpenChange={(open) => { if (!open) archiveConfirm.cancel() }}
                onConfirm={archiveConfirm.confirm}
                title={archiveConfirm.payload?.is_active ? "Archivar Categoría" : "Restaurar Categoría"}
                variant={archiveConfirm.payload?.is_active ? "warning" : "default"}
                confirmText={archiveConfirm.payload?.is_active ? "Archivar" : "Restaurar"}
                description={
                    archiveConfirm.payload?.is_active ? (
                        <p>
                            ¿Está seguro de que desea archivar la categoría <strong>{archiveConfirm.payload?.name}</strong>?
                            Dejará de estar disponible para nuevos productos. Puede restaurarla más adelante.
                        </p>
                    ) : (
                        <p>
                            ¿Está seguro de que desea restaurar la categoría <strong>{archiveConfirm.payload?.name}</strong>?
                        </p>
                    )
                }
            />

            <ActionConfirmModal
                open={bulkArchiveConfirm.isOpen}
                onOpenChange={(open) => { if (!open) bulkArchiveConfirm.cancel() }}
                onConfirm={bulkArchiveConfirm.confirm}
                title={bulkArchiveConfirm.payload?.every(c => c.is_active) ? "Archivar Categorías" : "Restaurar Categorías"}
                variant={bulkArchiveConfirm.payload?.every(c => c.is_active) ? "warning" : "default"}
                confirmText={bulkArchiveConfirm.payload?.every(c => c.is_active) ? "Archivar" : "Restaurar"}
                description={`¿Está seguro de que desea ${bulkArchiveConfirm.payload?.every(c => c.is_active) ? "archivar" : "restaurar"} ${bulkArchiveConfirm.payload?.length ?? 0} categorías?`}
            />
        </div>
    )
}
