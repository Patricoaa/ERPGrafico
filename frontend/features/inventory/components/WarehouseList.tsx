"use client"

import { showApiError } from "@/lib/errors"
import { useEffect, useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { WarehouseForm } from "./WarehouseForm"
import { Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import type { BulkAction } from "@/components/shared"
import React from "react"

import { useWarehouses, type Warehouse } from "@/features/inventory/hooks/useWarehouses"
import { SmartSearchBar, useClientSearch } from "@/components/shared"
import { warehouseSearchDef } from "@/features/inventory/searchDef"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"

interface WarehouseListProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function WarehouseList({ externalOpen, onExternalOpenChange, createAction }: WarehouseListProps) {
    const { warehouses, isLoading, refetch, deleteWarehouse } = useWarehouses()
    const { filterFn } = useClientSearch<Warehouse>(warehouseSearchDef)

    const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // T-106: clearSelection viene directamente del hook — no re-declarar localmente (ADR-0020)
    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Warehouse>({
        endpoint: '/inventory/warehouses'
    })

    // Open edit form if ?selected= is present (ADR-0020)
    useEffect(() => {
        if (selectedFromUrl && (!isFormOpen || editingWarehouse?.id !== selectedFromUrl.id)) {
            setEditingWarehouse(selectedFromUrl)
            setIsFormOpen(true)
        }
    }, [selectedFromUrl, isFormOpen, editingWarehouse])

    const handleCloseModal = () => {
        setIsFormOpen(false)
        setEditingWarehouse(null)
        onExternalOpenChange?.(false)
        clearSelection()
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

    const columns = useMemo<ColumnDef<Warehouse>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
            size: 40,
        },
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre del Almacén" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center py-1">
                    <DataCell.Text className="text-center">{row.original.name}</DataCell.Text>
                    <DataCell.Secondary className="text-[9px] opacity-40 tracking-widest">Ubicación Física</DataCell.Secondary>
                </div>
            ),
        },
        {
            accessorKey: "code",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Código" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Code className="text-primary">
                    {row.original.code}
                </DataCell.Code>
            ),
            size: 120,
        },
        {
            accessorKey: "address",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Dirección" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Secondary className="text-center w-full truncate max-w-[200px] opacity-70">
                    {row.original.address || "-"}
                </DataCell.Secondary>
            ),
        },
        createActionsColumn<Warehouse>({
            renderActions: (item) => (
                <>
                    <DataCell.Action icon={Pencil} title="Editar" onClick={() => {
                        const params = new URLSearchParams(searchParams.toString())
                        params.set('selected', String(item.id))
                        router.push(`${pathname}?${params.toString()}`, { scroll: false })
                    }} />
                    <DataCell.Action icon={Trash2} title="Eliminar" className="text-destructive" onClick={() => handleDelete(item)} />
                </>
            ),
        }),
    ], [handleDelete])

    const bulkActions = useMemo<BulkAction<Warehouse>[]>(() => [
        {
            key: "delete",
            label: "Eliminar",
            icon: Trash2,
            intent: "destructive",
            onClick: async (items) => {
                if (!confirm(`¿Está seguro de que desea eliminar ${items.length} almacenes? Esta acción es irreversible.`)) return
                try {
                    await Promise.all(items.map(w => deleteWarehouse(w.id)))
                    toast.success(`${items.length} almacenes eliminados`)
                } catch (error) {
                    showApiError(error, "Error al eliminar los almacenes (algunos podrían estar en uso)")
                }
            },
        },
    ], [deleteWarehouse])

    return (
        <div className="space-y-6">
            <DataTable
                columns={columns}
                data={filterFn(warehouses)}
                isLoading={isLoading}
                variant="embedded"
                leftAction={<SmartSearchBar searchDef={warehouseSearchDef} placeholder="Buscar almacén..." />}
                bulkActions={bulkActions}
                createAction={createAction}
            />

            <WarehouseForm
                onSuccess={refetch}
                open={isFormOpen || !!externalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCloseModal()
                    } else {
                        setIsFormOpen(true)
                    }
                }}
                initialData={editingWarehouse || undefined}
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
        </div >
    )
}
