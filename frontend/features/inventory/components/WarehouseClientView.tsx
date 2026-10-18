"use client"

import { showApiError } from "@/lib/errors"
import React, { useMemo, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Trash2 } from "lucide-react"
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
    const { warehouses, isLoading, isError, refetch, deleteWarehouse } = useWarehouses()
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

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null)

    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const bulkDeleteConfirm = useConfirmAction<Warehouse[]>(async (items) => {
        try {
            await Promise.all(items.map(w => deleteWarehouse(w.id)))
            toast.success(`${items.length} almacenes eliminados`)
        } catch (error) {
            showApiError(error, "Error al eliminar los almacenes (algunos podrían estar en uso)")
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

    const handleDelete = async (warehouse: Warehouse | null, isConfirmed = false) => {
        if (!warehouse) return

        if (!isConfirmed) {
            setWarehouseToDelete(warehouse)
            setIsDeleteModalOpen(true)
            return
        }

        try {
            await deleteWarehouse(warehouse.id)
            toast.success("Almacén eliminado correctamente.")
            setIsDeleteModalOpen(false)
        } catch (error) {
            console.error("Error deleting warehouse:", error)
            showApiError(error, "Error al eliminar el almacén.")
        }
    }

    const actionsCtx: WarehouseActionsCtx = {
        onEdit: (id) => openSelected(id),
        onDelete: (warehouse) => handleDelete(warehouse),
    }

    const bulkActions = useMemo<BulkAction<Warehouse>[]>(() => [
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
                open={isDeleteModalOpen}
                onOpenChange={setIsDeleteModalOpen}
                title="Eliminar Almacén"
                variant="destructive"
                onConfirm={() => { if (warehouseToDelete) return handleDelete(warehouseToDelete, true) }}
                confirmText="Eliminar permanentemente"
                description={
                    <div className="space-y-3">
                        <p className="text-sm font-medium">
                            ¿Confirma la eliminación del almacén <span className="font-black text-foreground underline">{warehouseToDelete?.name}</span>?
                        </p>
                        <p className="text-2xs text-muted-foreground bg-destructive/5 border border-destructive/10 p-3 rounded-md">
                            <strong className="text-destructive uppercase">Advertencia:</strong> Esta acción es irreversible y podría afectar la integridad de los stocks registrados en esta ubicación.
                        </p>
                    </div>
                }
            />

            <ActionConfirmModal
                open={bulkDeleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) bulkDeleteConfirm.cancel() }}
                onConfirm={bulkDeleteConfirm.confirm}
                title="Eliminar Almacenes"
                description={`¿Está seguro de que desea eliminar ${bulkDeleteConfirm.payload?.length ?? 0} almacenes? Esta acción es irreversible.`}
                variant="destructive"
            />
        </div>
    )
}
