"use client"

import { showApiError } from "@/lib/errors"

import React, { useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ActionConfirmModal, UnifiedSearchBar, useUnifiedSearch, type BulkAction } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { uomActions, type UoMActionsCtx } from "@/features/inventory/uomActions"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { useUoMs, type UoM } from "@/features/inventory/hooks/useUoMs"
import { uomUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import { uomEntity, uomViews } from "../entity-view/uom.entity"
import { UoMDrawer } from "./UoMDrawer"

interface UoMClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function UoMClientView({ externalOpen, onExternalOpenChange, createAction }: UoMClientViewProps) {
    const search = useUnifiedSearch(uomUnifiedSearchDef)
    const { uoms, isLoading, isError, refetch, deleteUoM } = useUoMs(search.filters)
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { entity: selectedUoM, isLoading: isLoadingSelected, clearSelection } = useSelectedEntity<UoM>({ endpoint: '/inventory/uoms' })
    const { openSelected } = useEntityRouteActions()
    const { view, onViewChange } = useCollectionViewMode("inventory.uom")
    const collection = useEntityCollection(uomEntity, { rows: uoms, isLoading, error: isError, refetch, isFiltered: search.isFiltered }, { defaultSort: uomViews.table.defaultSort })

    const handleCloseModal = () => {
        clearSelection()
        onExternalOpenChange?.(false)
        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }
    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await deleteUoM(id)
            toast.success("Eliminada correctamente")
        } catch (error) {
            showApiError(error, "No se puede eliminar (puede estar en uso)")
        }
    })
    const bulkDeleteConfirm = useConfirmAction<UoM[]>(async (items) => {
        try {
            await Promise.all(items.map(u => deleteUoM(u.id)))
            toast.success(`${items.length} unidades eliminadas`)
        } catch (error) {
            showApiError(error, "Error al eliminar las unidades")
            throw error
        }
    })
    const actionsCtx: UoMActionsCtx = {
        onEdit: (id) => openSelected(id),
        onDelete: (id) => deleteConfirm.requestConfirm(id),
    }

    const bulkActions = useMemo<BulkAction<UoM>[]>(() => [
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
                // Edit through the UoM modal (?selected, ADR-0020), not the drawer registry.
                onOpen={(uom) => openSelected(uom.id)}
                actions={uomActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                            <UnifiedSearchBar
                                config={uomUnifiedSearchDef}
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
                                placeholder="Buscar unidad..."
                            />
                        </div>
                        {createAction}
                    </div>
                </Collection.Toolbar>
                <Collection.View
                    table={uomViews.table}
                    card={uomViews.card}
                    emptyTitle="Aún no hay unidades de medida"
                    emptyDescription="Define unidades para medir, comprar y vender tus productos."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
                <Collection.BulkBar actions={bulkActions} />
            </Collection.Root>

            {/* Unified Modal — UoMForm keeps rich FK + audit widgets for both create and edit.
                Edit mode driven by ?selected={id} (ADR-0020); create mode driven by externalOpen. */}
            <UoMDrawer
                open={!!selectedUoM || isLoadingSelected || !!externalOpen}
                onOpenChange={(open) => { if (!open) handleCloseModal() }}
                initialData={selectedUoM ?? undefined}
                onSuccess={() => { refetch() }}
            />

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Unidad de Medida"
                description="¿Seguro que deseas eliminar esta unidad de medida?"
                variant="destructive"
            />

            <ActionConfirmModal
                open={bulkDeleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) bulkDeleteConfirm.cancel() }}
                onConfirm={bulkDeleteConfirm.confirm}
                title="Eliminar Unidades de Medida"
                description={`¿Está seguro de que desea eliminar ${bulkDeleteConfirm.payload?.length ?? 0} unidades de medida?`}
                variant="destructive"
            />
        </div>
    )
}
