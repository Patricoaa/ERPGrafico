"use client"

import { showApiError } from "@/lib/errors"

import React, { useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DataTableView, DataTableColumnHeader, EntityCard, StatusBadge } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2 } from "lucide-react"
import { DataCell, createActionsColumn } from '@/components/shared'

import type { BulkAction } from "@/components/shared"
import { UoMDrawer } from "./UoMDrawer"
import { toast } from "sonner"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { useUoMs, type UoM } from "@/features/inventory/hooks/useUoMs"
import { SmartSearchBar, useSmartSearch } from "@/components/shared"
import { uomSearchDef } from "@/features/inventory/searchDef"

const UOM_TYPE_CONFIG: Record<UoM['uom_type'], { status: string; label: string }> = {
    REFERENCE: { status: 'INFO',    label: 'Referencia' },
    BIGGER:    { status: 'SUCCESS', label: 'Mayor'      },
    SMALLER:   { status: 'WARNING', label: 'Menor'      },
}

interface UoMClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function UoMClientView({ externalOpen, onExternalOpenChange, createAction }: UoMClientViewProps) {
    const { filters } = useSmartSearch(uomSearchDef)
    const { uoms, isLoading, refetch, deleteUoM } = useUoMs(filters)
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { entity: selectedUoM, isLoading: isLoadingSelected, clearSelection } = useSelectedEntity<UoM>({ endpoint: '/inventory/uoms' })
    const { openSelected } = useEntityRouteActions()
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
    const handleDelete = (id: number) => deleteConfirm.requestConfirm(id)
    const columns = useMemo<ColumnDef<UoM>[]>(() => [
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
            accessorKey: "id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Código Interno" className="justify-center" />,
            cell: ({ row }) => <DataCell.Code>{row.getValue("id")}</DataCell.Code>,
            size: 80,
        },
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Text>
                    {row.getValue("name")}
                </DataCell.Text>
            ),
        },
        {
            accessorKey: "category_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Categoría" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Secondary>
                    {row.getValue("category_name")}
                </DataCell.Secondary>
            ),
        },
        {
            accessorKey: "uom_type",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
            cell: ({ row }) => {
                const type = row.getValue("uom_type") as UoM['uom_type']
                return (
                    <DataCell.Status
                        status={UOM_TYPE_CONFIG[type]?.status || 'NEUTRAL'}
                        label={UOM_TYPE_CONFIG[type]?.label || type}
                    />
                )
            },
        },
        {
            accessorKey: "ratio",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Ratio" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Number value={row.getValue("ratio")} />
            ),
        },
        createActionsColumn<UoM>({
            renderActions: (item) => (
                <>
                    <DataCell.Action action="edit" onClick={() => openSelected(item.id)} />
                    <DataCell.Action action="delete" onClick={() => handleDelete(item.id)} />
                </>
            ),
        }),
    ], [handleDelete, openSelected])

    const bulkActions = useMemo<BulkAction<UoM>[]>(() => [
        {
            key: "delete",
            label: "Eliminar",
            icon: Trash2,
            intent: "destructive",
            onClick: async (items) => bulkDeleteConfirm.requestConfirm(items),
        },
    ], [deleteUoM, bulkDeleteConfirm])


    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    columns={columns}
                    data={uoms}
                    isLoading={isLoading}
                    entityLabel="inventory.uom"
                    variant="embedded"
                    leftAction={<SmartSearchBar searchDef={uomSearchDef} placeholder="Buscar unidad..." className="w-full" />}
                    bulkActions={bulkActions}
                    createAction={createAction}
                    renderCard={(uom: UoM) => (
                        <EntityCard onClick={() => openSelected(uom.id)}>
                            <EntityCard.Header
                                title={uom.name}
                                subtitle={uom.category_name}
                                trailing={
                                    <StatusBadge
                                        status={UOM_TYPE_CONFIG[uom.uom_type]?.status || 'NEUTRAL'}
                                        label={UOM_TYPE_CONFIG[uom.uom_type]?.label || uom.uom_type}
                                        size="sm"
                                    />
                                }
                            />
                            <EntityCard.Body>
                                <EntityCard.Field label="Ratio" value={<DataCell.Number value={uom.ratio} />} />
                            </EntityCard.Body>
                        </EntityCard>
                    )}
                />
            </div>

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
