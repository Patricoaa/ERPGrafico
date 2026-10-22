"use client"

import { showApiError } from "@/lib/errors"
import React, { useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Archive, ArchiveRestore } from "lucide-react"
import { toast } from "sonner"
import { ActionConfirmModal, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch, type BulkAction } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { warehouseActions, type WarehouseActionsCtx } from "@/features/inventory/warehouseActions"
import { useWarehouses, type Warehouse } from "@/features/inventory/hooks/useWarehouses"
import { warehouseUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import { warehouseEntity, warehouseViews } from "../entity-view/warehouse.entity"
import { WarehouseDrawer } from "./WarehouseDrawer"

interface WarehouseClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function WarehouseClientView({ externalOpen, onExternalOpenChange, createAction }: WarehouseClientViewProps) {
    const { warehouses, isLoading, isError, refetch, archiveWarehouse } = useWarehouses()
    const search = useUnifiedSearch(warehouseUnifiedSearchDef)
    const { filterFn } = search
    const { view, onViewChange } = useCollectionViewMode("inventory.warehouse")
    const rows = useMemo(() => filterFn(warehouses), [filterFn, warehouses])
    // Rows are filtered here: a failed refetch with cached data must read "no results", not "error".
    const collection = useEntityCollection(
        warehouseEntity,
        { rows, isLoading, error: isError && warehouses.length === 0, refetch, isFiltered: search.isFiltered },
        { defaultSort: warehouseViews.table.defaultSort },
    )

    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const archiveConfirm = useConfirmAction<Warehouse>(async (warehouse) => {
        const isArchiving = warehouse.is_active
        try {
            await archiveWarehouse({ id: warehouse.id, is_active: !warehouse.is_active })
            toast.success(`Almacén ${isArchiving ? "archivado" : "restaurado"} correctamente`)
        } catch (error) {
            showApiError(error, `No se puede ${isArchiving ? "archivar" : "restaurar"} el almacén`)
        }
    })

    const bulkArchiveConfirm = useConfirmAction<Warehouse[]>(async (items) => {
        const isArchiving = items.every(w => w.is_active)
        try {
            await Promise.all(items.map(w => archiveWarehouse({ id: w.id, is_active: !isArchiving })))
            toast.success(`${items.length} almacenes ${isArchiving ? "archivados" : "restaurados"}`)
        } catch (error) {
            showApiError(error, `Error al ${isArchiving ? "archivar" : "restaurar"} los almacenes`)
            throw error
        }
    })

    // T-106: clearSelection viene directamente del hook — no re-declarar localmente (ADR-0020)
    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Warehouse>({
        endpoint: '/inventory/warehouses'
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

    const actionsCtx: WarehouseActionsCtx = {
        onEdit: (id) => openSelected(id),
        onArchive: (warehouse) => archiveConfirm.requestConfirm(warehouse),
    }

    const bulkActions = useMemo<BulkAction<Warehouse>[]>(() => [
        {
            key: "restore",
            label: "Restaurar",
            icon: ArchiveRestore,
            intent: "success",
            hidden: (items) => items.length === 0 || !items.every(w => !w.is_active),
            onClick: async (items) => bulkArchiveConfirm.requestConfirm(items),
        },
        {
            key: "archive",
            label: "Archivar",
            icon: Archive,
            intent: "destructive",
            hidden: (items) => items.length === 0 || !items.every(w => w.is_active),
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
                onOpen={(warehouse) => openSelected(warehouse.id)}
                actions={warehouseActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar
                        config={warehouseUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar almacén..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={warehouseViews.table}
                    card={warehouseViews.card}
                    emptyTitle="Aún no hay almacenes"
                    emptyDescription="Crea un almacén para gestionar ubicaciones y existencias de inventario."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
                <Collection.BulkBar actions={bulkActions} />
            </Collection.Root>

            <WarehouseDrawer
                onSuccess={refetch}
                open={drawerOpen}
                onOpenChange={handleCloseModal}
                initialData={selectedFromUrl || undefined}
            />

            <ActionConfirmModal
                open={archiveConfirm.isOpen}
                onOpenChange={(open) => { if (!open) archiveConfirm.cancel() }}
                onConfirm={archiveConfirm.confirm}
                title={archiveConfirm.payload?.is_active ? "Archivar Almacén" : "Restaurar Almacén"}
                variant={archiveConfirm.payload?.is_active ? "warning" : "default"}
                confirmText={archiveConfirm.payload?.is_active ? "Archivar" : "Restaurar"}
                description={
                    archiveConfirm.payload?.is_active ? (
                        <div className="space-y-3">
                            <p className="text-sm font-medium">
                                ¿Confirma archivar el almacén <span className="font-black text-foreground underline">{archiveConfirm.payload?.name}</span>?
                            </p>
                            <p className="text-2xs text-muted-foreground bg-warning/5 border border-warning/10 p-3 rounded-md">
                                Dejará de estar disponible para nuevas operaciones. Puede restaurarlo más adelante.
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm font-medium">
                            ¿Confirma restaurar el almacén <span className="font-black text-foreground underline">{archiveConfirm.payload?.name}</span>?
                        </p>
                    )
                }
            />

            <ActionConfirmModal
                open={bulkArchiveConfirm.isOpen}
                onOpenChange={(open) => { if (!open) bulkArchiveConfirm.cancel() }}
                onConfirm={bulkArchiveConfirm.confirm}
                title={bulkArchiveConfirm.payload?.every(w => w.is_active) ? "Archivar Almacenes" : "Restaurar Almacenes"}
                description={`¿Está seguro de que desea ${bulkArchiveConfirm.payload?.every(w => w.is_active) ? "archivar" : "restaurar"} ${bulkArchiveConfirm.payload?.length ?? 0} almacenes?`}
                variant={bulkArchiveConfirm.payload?.every(w => w.is_active) ? "warning" : "default"}
                confirmText={bulkArchiveConfirm.payload?.every(w => w.is_active) ? "Archivar" : "Restaurar"}
            />
        </div>
    )
}
