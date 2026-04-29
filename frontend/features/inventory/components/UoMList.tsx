"use client"

import { showApiError } from "@/lib/errors"

import React, { useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef, RowSelectionState } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Search } from "lucide-react"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { UoMForm } from "./UoMForm"

import { toast } from "sonner"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

import { useUoMs, type UoM } from "@/features/inventory/hooks/useUoMs"

interface UoMListProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function UoMList({ externalOpen, onExternalOpenChange, createAction }: UoMListProps) {
    const { uoms, refetch, deleteUoM } = useUoMs()

    // Modal State
    const [selectedRows, setSelectedRows] = useState<RowSelectionState>({})
    const [isUoMModalOpen, setIsUoMModalOpen] = useState(false)
    const [editingUoM, setEditingUoM] = useState<Partial<UoM>>({})

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleCloseModal = () => {
        setIsUoMModalOpen(false)
        setEditingUoM({})
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
                <DataCell.Secondary className="text-center w-full">
                    {row.getValue("category_name")}
                </DataCell.Secondary>
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
                    <DataCell.Action icon={Pencil} title="Editar" onClick={() => { setEditingUoM(item); setIsUoMModalOpen(true) }} />
                    <DataCell.Action icon={Trash2} title="Eliminar" className="text-destructive" onClick={() => handleDelete(item.id)} />
                </>
            ),
        }),
    ], [handleDelete])

    const selectedUoMs = useMemo(() => {
        return uoms.filter((_, index) => selectedRows[index])
    }, [selectedRows, uoms])

    const handleBulkDelete = async () => {
        if (selectedUoMs.length === 0) return
        if (!confirm(`¿Está seguro de que desea eliminar ${selectedUoMs.length} unidades de medida?`)) return

        try {
            await Promise.all(selectedUoMs.map(u => deleteUoM(u.id)))
            toast.success(`${selectedUoMs.length} unidades eliminadas`)
            setSelectedRows({})
        } catch (error) {
            showApiError(error, "Error al eliminar las unidades")
        }
    }


    return (
        <div className="space-y-4">
            <DataTable
                columns={columns}
                data={uoms}
                cardMode
                filterColumn="name"
                searchPlaceholder="Buscar unidad..."
                useAdvancedFilter={true}
                onRowSelectionChange={setSelectedRows}
                batchActions={
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive-foreground hover:bg-destructive/20 gap-2"
                        onClick={handleBulkDelete}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                    </Button>
                }
                globalFilterFields={["name", "category_name"]}
                facetedFilters={[
                    {
                        column: "uom_type",
                        title: "Tipo",
                        options: [
                            { label: "Referencia", value: "REFERENCE" },
                            { label: "Mayor", value: "BIGGER" },
                            { label: "Menor", value: "SMALLER" },
                        ],
                    },
                ]}
                createAction={createAction}
            />

            <UoMForm
                open={isUoMModalOpen || !!externalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCloseModal()
                    } else {
                        setIsUoMModalOpen(true)
                    }
                }}
                initialData={editingUoM.id ? editingUoM : undefined}
                onSuccess={refetch}
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
