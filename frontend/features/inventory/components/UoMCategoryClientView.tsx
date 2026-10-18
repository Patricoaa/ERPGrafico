"use client"

import { showApiError } from "@/lib/errors"

import React, { useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ActionConfirmModal, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch, type BulkAction } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { uomCategoryActions, type UoMCategoryActionsCtx } from "@/features/inventory/uomCategoryActions"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { useUoMs, type UoMCategory } from "@/features/inventory/hooks/useUoMs"
import { uomCategoryUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import { uomCategoryEntity, uomCategoryViews } from "../entity-view/uomCategory.entity"
import { UoMCategoryDrawer } from "./UoMCategoryDrawer"

interface UoMCategoryClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function UoMCategoryClientView({ externalOpen, onExternalOpenChange, createAction }: UoMCategoryClientViewProps) {
    const { categories, isCategoriesLoading, isCategoriesError, refetchCategories, deleteUoMCategory } = useUoMs()
    const search = useUnifiedSearch(uomCategoryUnifiedSearchDef)
    const { filterFn } = search
    const { view, onViewChange } = useCollectionViewMode("inventory.uomcategory")
    const rows = useMemo(() => filterFn(categories), [filterFn, categories])
    // Rows are filtered here: a failed refetch with cached data must read "no results", not "error".
    const collection = useEntityCollection(
        uomCategoryEntity,
        { rows, isLoading: isCategoriesLoading, error: isCategoriesError && categories.length === 0, refetch: refetchCategories, isFiltered: search.isFiltered },
        { defaultSort: uomCategoryViews.table.defaultSort },
    )

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const isCreateModal = searchParams.get("modal") === "new"
    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<UoMCategory>({ endpoint: '/inventory/uom-categories' })
    const { openSelected } = useEntityRouteActions()

    const dialogOpen = isCreateModal || !!selectedFromUrl || !!externalOpen

    const handleCloseModal = () => {
        clearSelection()
        onExternalOpenChange?.(false)
        if (searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const handleSave = async (category?: UoMCategory) => {
        if (category) {
            handleCloseModal()
            void refetchCategories()
        }
    }

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            // deleteUoMCategory invalida UOM_CATEGORIES + UOMS (category_name derivado)
            // y emite el toast desde el hook.
            await deleteUoMCategory(id)
        } catch (error) {
            showApiError(error, "Error al eliminar (puede estar en uso)")
        }
    })

    const bulkDeleteConfirm = useConfirmAction<UoMCategory[]>(async (items) => {
        try {
            await Promise.all(items.map(c => deleteUoMCategory(c.id)))
            toast.success(`${items.length} categorías eliminadas`)
        } catch (error) {
            showApiError(error, "Error al eliminar las categorías (pueden tener unidades asociadas)")
            throw error
        }
    })

    const handleDelete = (id: number) => deleteConfirm.requestConfirm(id)

    const actionsCtx: UoMCategoryActionsCtx = {
        onEdit: (item) => openSelected(item.id),
        onDelete: (id) => handleDelete(id),
    }

    const bulkActions = useMemo<BulkAction<UoMCategory>[]>(() => [
        {
            key: "delete",
            label: "Eliminar",
            icon: Trash2,
            intent: "destructive",
            onClick: async (items) => bulkDeleteConfirm.requestConfirm(items),
        },
    ], [bulkDeleteConfirm])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                selection="bulk"
                view={view}
                onViewChange={onViewChange}
                onOpen={(cat) => openSelected(cat.id)}
                actions={uomCategoryActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar
                        config={uomCategoryUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar categoría..."
                    />
                </Collection.Toolbar>
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

            <UoMCategoryDrawer
                open={dialogOpen}
                onOpenChange={(open) => {
                    if (!open) handleCloseModal()
                }}
                initialData={isCreateModal ? undefined : (selectedFromUrl ?? undefined)}
                onSuccess={handleSave}
            />

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Categoría"
                description="¿Eliminar categoría? Esto eliminará las unidades asociadas y no se puede deshacer."
                variant="destructive"
            />

            <ActionConfirmModal
                open={bulkDeleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) bulkDeleteConfirm.cancel() }}
                onConfirm={bulkDeleteConfirm.confirm}
                title="Eliminar Categorías"
                description={`¿Está seguro de que desea eliminar ${bulkDeleteConfirm.payload?.length ?? 0} categorías de unidades?`}
                variant="destructive"
            />
        </div>
    )
}
