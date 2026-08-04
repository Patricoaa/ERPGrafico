"use client"

import { showApiError } from "@/lib/errors"
import {useState, useMemo} from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import {ActionConfirmModal, DataTableView, AutoEntityCard} from '@/components/shared'
import { warehouseActions, type WarehouseActionsCtx } from "@/features/inventory/warehouseActions"
import { type ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { WarehouseDrawer } from "./WarehouseDrawer"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { warehouseFields } from "../warehouseFields"

import type { BulkAction } from "@/components/shared"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import React from "react"

import { useWarehouses, type Warehouse } from "@/features/inventory/hooks/useWarehouses"
import { UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { warehouseUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"

interface WarehouseClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function WarehouseClientView({ externalOpen, onExternalOpenChange, createAction }: WarehouseClientViewProps) {
    const { warehouses, isLoading, refetch, deleteWarehouse } = useWarehouses()
    const search = useUnifiedSearch(warehouseUnifiedSearchDef)

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

    const columns = useMemo<ColumnDef<Warehouse>[]>(() => {
        const [nameCol, codeCol, addressCol] = warehouseFields.toColumns()
        return [
            {
                id: "select",
                header: ({ table }) => (
                    <Checkbox
                        checked={table.getIsAllPageRowsSelected()}
                        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                        aria-label="Select all"
                        variant="circle"
                    />
                ),
                cell: ({ row }) => (
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label="Select row"
                        variant="circle"
                    />
                ),
                enableSorting: false,
                enableHiding: false,
                size: 40,
            },
            nameCol,
            codeCol,
            addressCol,
            warehouseActions.auto(actionsCtx),
        ]
    }, [actionsCtx])

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
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="inventory.warehouse"
                    columns={columns}
                    data={search.filterFn(warehouses)}
                    isLoading={isLoading}
                    variant="embedded"
                    unifiedSearch={<UnifiedSearchBar
                        config={warehouseUnifiedSearchDef}
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
                        placeholder="Buscar almacén..."
                    />}
                    unifiedSearchConfig={warehouseUnifiedSearchDef}
                    currentGroupBy={search.groupBy}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    bulkActions={bulkActions}
                    createAction={createAction}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "inventory",
                        title: "Aún no hay almacenes",
                        description: "Crea un almacén para gestionar ubicaciones y existencias de inventario.",
                    }}
                    renderCard={(warehouse: Warehouse) => (
                        <AutoEntityCard
                            key={warehouse.id}
                            data={warehouse}
                            fields={warehouseFields}
                            entityLabel="inventory.warehouse"
                            actions={warehouseActions.render(warehouse, actionsCtx)}
                            defaultAction={warehouseActions.defaultAction(actionsCtx)?.(warehouse) ?? (() => openSelected(warehouse.id))}

                        />
                    )}
                />
            </div>

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
                        <p className="text-[11px] text-muted-foreground bg-destructive/5 border border-destructive/10 p-3 rounded-md">
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
        </div >
    )
}
