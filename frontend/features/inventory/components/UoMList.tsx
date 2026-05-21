"use client"

import { showApiError } from "@/lib/errors"

import React, { useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DataTable } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2 } from "lucide-react"
import { DataCell, createActionsColumn } from '@/components/shared'
import { StatusBadge } from "@/components/shared/StatusBadge"
import type { BulkAction } from "@/components/shared"
import { UoMForm } from "./UoMForm"

import { toast } from "sonner"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"

import { useUoMs, type UoM } from "@/features/inventory/hooks/useUoMs"
import { SmartSearchBar, useSmartSearch } from "@/components/shared"
import { uomSearchDef } from "@/features/inventory/searchDef"

interface UoMListProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function UoMList({ externalOpen, onExternalOpenChange, createAction }: UoMListProps) {
    const { filters } = useSmartSearch(uomSearchDef)
    const { uoms, isLoading, refetch, deleteUoM } = useUoMs(filters)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // ADR-0020: edit modal opens via ?selected={id}
    const { entity: selectedUoM, isLoading: isLoadingSelected, clearSelection } =
        useSelectedEntity<UoM>({ endpoint: '/inventory/uoms' })
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
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Text className="text-center w-full">
                    {row.getValue("name")}
                </DataCell.Text>
            ),
        },
        {
            accessorKey: "category_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Categoría" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Text className="font-normal">
                    {row.getValue("category_name")}
                </DataCell.Text>
            ),
        },
        {
            accessorKey: "uom_type",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
            cell: ({ row }) => {
                const type = row.getValue("uom_type") as string
                const config: Record<string, { status: string, label: string }> = {
                    'REFERENCE': { status: 'INFO', label: 'Referencia' },
                    'BIGGER': { status: 'SUCCESS', label: 'Mayor' },
                    'SMALLER': { status: 'WARNING', label: 'Menor' }
                }
                return (
                    <div className="flex justify-center w-full">
                        <StatusBadge
                            status={config[type]?.status || 'NEUTRAL'}
                            label={config[type]?.label || type}
                            size="sm"
                        />
                    </div>
                )
            },
        },
        {
            accessorKey: "ratio",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Ratio" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Number
                    value={row.getValue("ratio")}
                    decimals={2}
                    className="text-center w-full"
                />
            ),
        },
        createActionsColumn<UoM>({
            renderActions: (item) => (
                <>
                    <DataCell.Action action="edit"   onClick={() => openSelected(item.id)} />
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
            onClick: async (items) => {
                if (!confirm(`¿Está seguro de que desea eliminar ${items.length} unidades de medida?`)) return
                try {
                    await Promise.all(items.map(u => deleteUoM(u.id)))
                    toast.success(`${items.length} unidades eliminadas`)
                } catch (error) {
                    showApiError(error, "Error al eliminar las unidades")
                }
            },
        },
    ], [deleteUoM])


    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTable
                    columns={columns}
                    data={uoms}
                    isLoading={isLoading}
                    variant="embedded"
                    leftAction={<SmartSearchBar searchDef={uomSearchDef} placeholder="Buscar unidad..." className="w-80" />}
                    bulkActions={bulkActions}
                    createAction={createAction}
                />
            </div>

            {/* Unified Modal — UoMForm keeps rich FK + audit widgets for both create and edit.
                Edit mode driven by ?selected={id} (ADR-0020); create mode driven by externalOpen. */}
            <UoMForm
                open={!!selectedUoM || isLoadingSelected || !!externalOpen}
                onOpenChange={(open) => { if (!open) handleCloseModal() }}
                initialData={selectedUoM ?? undefined}
                onSuccess={() => { refetch(); handleCloseModal() }}
            />

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Unidad de Medida"
                description="¿Seguro que deseas eliminar esta unidad de medida?"
                variant="destructive"
            />
        </div>
    )
}
