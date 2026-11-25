"use client"

import { EntityPanelTab, useGlobalModals } from "@/components/providers"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import { showApiError } from "@/lib/errors"

import React, { useMemo } from "react"

import { Archive, ArchiveRestore } from "lucide-react"
import { toast } from "sonner"
import { ActionConfirmModal, type BulkAction } from "@/components/shared"
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { uomCategoryActions, type UoMCategoryActionsCtx } from "@/features/inventory/uomCategoryActions"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { useCreatePanelRoute } from "@/hooks/useCreatePanelRoute"
import { useUoMs, type UoMCategory } from "@/features/inventory/hooks/useUoMs"
import { uomCategoryEntity, uomCategoryViews } from "../entity-view/uomCategory.entity"
import { UoMCategoryDrawer } from "./UoMCategoryDrawer"

interface UoMCategoryClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function UoMCategoryClientView({ externalOpen, onExternalOpenChange, createAction }: UoMCategoryClientViewProps) {
    const { categories, isCategoriesLoading, isCategoriesError, refetchCategories, archiveUoMCategory } = useUoMs()
    const query = useCollectionQuery(uomCategoryEntity, { sorting: "client" })
    const { search } = query
    const { filterFn } = search
    const { view, onViewChange } = useCollectionViewMode("inventory.uomcategory")
    const rows = useMemo(() => filterFn(categories), [filterFn, categories])
    // Rows are filtered here: a failed refetch with cached data must read "no results", not "error".
    const collection = useEntityCollection(
        uomCategoryEntity,
        { rows, isLoading: isCategoriesLoading, error: isCategoriesError && categories.length === 0, refetch: refetchCategories, isFiltered: search.isFiltered },
        { sorting: query.sorting },
    )

    const panel = useCreatePanelRoute({ resolved: false, external: { open: externalOpen, onOpenChange: onExternalOpenChange } })
    const { openEntity } = useGlobalModals()
    // ADR-0152: cada categoría abre su propia pestaña; `?selected` solo es enlace profundo.
    useDeepLinkEntity("inventory.uomcategory")

    const handleSave = async (category?: UoMCategory) => {
        if (category) {
            panel.close()
            void refetchCategories()
        }
    }

    const archiveConfirm = useConfirmAction<UoMCategory>(async (cat) => {
        const isArchiving = cat.is_active
        try {
            await archiveUoMCategory({ id: cat.id, is_active: !cat.is_active })
            toast.success(`Categoría ${isArchiving ? "archivada" : "restaurada"} correctamente`)
        } catch (error) {
            showApiError(error, `No se puede ${isArchiving ? "archivar" : "restaurar"} (puede estar en uso)`)
        }
   })

    const bulkArchiveConfirm = useConfirmAction<UoMCategory[]>(async (items) => {
        const isArchiving = items.every(c => c.is_active)
        try {
            await Promise.all(items.map(c => archiveUoMCategory({ id: c.id, is_active: !isArchiving })))
            toast.success(`${items.length} categorías ${isArchiving ? "archivadas" : "restauradas"}`)
        } catch (error) {
            showApiError(error, `Error al ${isArchiving ? "archivar" : "restaurar"} las categorías`)
            throw error
        }
   })

    const actionsCtx: UoMCategoryActionsCtx = {
        onEdit: (item) => openEntity("inventory.uomcategory", item.id, item),
        onArchive: (item) => archiveConfirm.requestConfirm(item),
    }

    const bulkActions = useMemo<BulkAction<UoMCategory>[]>(() => [
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
                query={query}
                selection="bulk"
                view={view}
                onViewChange={onViewChange}
                actions={uomCategoryActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction} />
                <Collection.View
                    table={uomCategoryViews.table}
                    card={uomCategoryViews.card}
                    emptyTitle="Aún no hay categorías de medida"
                    emptyDescription="Agrupa unidades de medida relacionadas (peso, longitud, volumen…)."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
                <Collection.BulkBar actions={bulkActions} />
            </Collection.Root>

            <EntityPanelTab label="inventory.uomcategory" {...panel.tab}>
                {(open) => (
                    <UoMCategoryDrawer
                        open={open}
                        onOpenChange={(open) => {
                            if (!open) panel.close()
                        }}
                        onSuccess={handleSave}
                    />
                )}
            </EntityPanelTab>

            <ActionConfirmModal
                open={archiveConfirm.isOpen}
                onOpenChange={(open) => { if (!open) archiveConfirm.cancel() }}
                onConfirm={archiveConfirm.confirm}
                title={archiveConfirm.payload?.is_active ? "Archivar Categoría" : "Restaurar Categoría"}
                description={archiveConfirm.payload?.is_active
                    ? "¿Archivar categoría? Dejará de estar disponible para nuevas unidades de medida."
                    : "¿Restaurar esta categoría de unidades de medida?"}
                variant={archiveConfirm.payload?.is_active ? "warning" : "default"}
                confirmText={archiveConfirm.payload?.is_active ? "Archivar" : "Restaurar"}
            />

            <ActionConfirmModal
                open={bulkArchiveConfirm.isOpen}
                onOpenChange={(open) => { if (!open) bulkArchiveConfirm.cancel() }}
                onConfirm={bulkArchiveConfirm.confirm}
                title={bulkArchiveConfirm.payload?.every(c => c.is_active) ? "Archivar Categorías" : "Restaurar Categorías"}
                description={`¿Está seguro de que desea ${bulkArchiveConfirm.payload?.every(c => c.is_active) ? "archivar" : "restaurar"} ${bulkArchiveConfirm.payload?.length ?? 0} categorías de unidades?`}
                variant={bulkArchiveConfirm.payload?.every(c => c.is_active) ? "warning" : "default"}
                confirmText={bulkArchiveConfirm.payload?.every(c => c.is_active) ? "Archivar" : "Restaurar"}
            />
        </div>
    )
}
