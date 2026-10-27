"use client"

import { EntityPanelTab } from "@/components/providers"
import { showApiError } from "@/lib/errors"

import React, { useMemo } from "react"

import { Archive, ArchiveRestore } from "lucide-react"
import { toast } from "sonner"
import { ActionConfirmModal, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch, type BulkAction } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { uomActions, type UoMActionsCtx } from "@/features/inventory/uomActions"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
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
    const { uoms, isLoading, isError, refetch, archiveUoM } = useUoMs(search.filters)
    const panel = useEntityPanelRoute<UoM>({ endpoint: '/inventory/uoms', external: { open: externalOpen, onOpenChange: onExternalOpenChange } })
    const selectedUoM = panel.entity
    const { openSelected } = useEntityRouteActions()
    const { view, onViewChange } = useCollectionViewMode("inventory.uom")
    const collection = useEntityCollection(uomEntity, { rows: uoms, isLoading, error: isError, refetch, isFiltered: search.isFiltered }, { defaultSort: uomViews.table.defaultSort })

    const archiveConfirm = useConfirmAction<UoM>(async (uom) => {
        const isArchiving = uom.is_active
        try {
            await archiveUoM({ id: uom.id, is_active: !uom.is_active })
            toast.success(`Unidad ${isArchiving ? "archivada" : "restaurada"} correctamente`)
        } catch (error) {
            showApiError(error, `No se puede ${isArchiving ? "archivar" : "restaurar"} (puede estar en uso)`)
        }
   })
    const bulkArchiveConfirm = useConfirmAction<UoM[]>(async (items) => {
        const isArchiving = items.every(u => u.is_active)
        try {
            await Promise.all(items.map(u => archiveUoM({ id: u.id, is_active: !isArchiving })))
            toast.success(`${items.length} unidades ${isArchiving ? "archivadas" : "restauradas"}`)
        } catch (error) {
            showApiError(error, `Error al ${isArchiving ? "archivar" : "restaurar"} las unidades`)
            throw error
        }
   })
    const actionsCtx: UoMActionsCtx = {
        onEdit: (id) => openSelected(id),
        onArchive: (uom) => archiveConfirm.requestConfirm(uom),
    }

    const bulkActions = useMemo<BulkAction<UoM>[]>(() => [
        {
            key: "restore",
            label: "Restaurar",
            icon: ArchiveRestore,
            intent: "success",
            hidden: (items) => items.length === 0 || !items.every(u => !u.is_active),
            onClick: async (items) => bulkArchiveConfirm.requestConfirm(items),
        },
        {
            key: "archive",
            label: "Archivar",
            icon: Archive,
            intent: "destructive",
            hidden: (items) => items.length === 0 || !items.every(u => u.is_active),
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
                // Edit through the UoM modal (?selected, ADR-0020), not the drawer registry.
                onOpen={(uom) => openSelected(uom.id)}
                actions={uomActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar
                        config={uomUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar unidad..."
                    />
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
            <EntityPanelTab label="inventory.uom" {...panel.tab}>
                {(open) => (
                    <UoMDrawer
                        open={open}
                        onOpenChange={(open) => { if (!open) panel.close() }}
                        initialData={selectedUoM ?? undefined}
                        onSuccess={() => { refetch() }}
                    />
                )}
            </EntityPanelTab>

            <ActionConfirmModal
                open={archiveConfirm.isOpen}
                onOpenChange={(open) => { if (!open) archiveConfirm.cancel() }}
                onConfirm={archiveConfirm.confirm}
                title={archiveConfirm.payload?.is_active ? "Archivar Unidad de Medida" : "Restaurar Unidad de Medida"}
                description={archiveConfirm.payload?.is_active
                    ? "¿Seguro que deseas archivar esta unidad de medida? Dejará de estar disponible para nuevas operaciones."
                    : "¿Seguro que deseas restaurar esta unidad de medida?"}
                variant={archiveConfirm.payload?.is_active ? "warning" : "default"}
                confirmText={archiveConfirm.payload?.is_active ? "Archivar" : "Restaurar"}
            />

            <ActionConfirmModal
                open={bulkArchiveConfirm.isOpen}
                onOpenChange={(open) => { if (!open) bulkArchiveConfirm.cancel() }}
                onConfirm={bulkArchiveConfirm.confirm}
                title={bulkArchiveConfirm.payload?.every(u => u.is_active) ? "Archivar Unidades de Medida" : "Restaurar Unidades de Medida"}
                description={`¿Está seguro de que desea ${bulkArchiveConfirm.payload?.every(u => u.is_active) ? "archivar" : "restaurar"} ${bulkArchiveConfirm.payload?.length ?? 0} unidades de medida?`}
                variant={bulkArchiveConfirm.payload?.every(u => u.is_active) ? "warning" : "default"}
                confirmText={bulkArchiveConfirm.payload?.every(u => u.is_active) ? "Archivar" : "Restaurar"}
            />
        </div>
    )
}
