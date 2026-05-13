"use client"

import React, { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
    ColumnDef
} from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataTable } from "@/components/ui/data-table"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"
import { Pencil, Trash2, Layers } from "lucide-react"
import api from "@/lib/api"
import { BOMFormModal } from "@/features/production/components/BOMFormModal"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { ToolbarCreateButton, SmartSearchBar, useSmartSearch } from "@/components/shared"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { useAllBOMs } from "@/features/production/hooks/useBOMs"
import { bomSearchDef } from "@/features/production/searchDef"

import type { BOM } from "@/features/production/types"

interface BOMListItem extends BOM {
    product_name: string
    product_code: string
    product_internal_code?: string
    lines_count: number
    total_cost: number
}

export default function BOMsPage() {
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingBom, setEditingBom] = useState<BOMListItem | null>(null)
    const searchParams = useSearchParams()
    const router = useRouter()
    const isNewModalOpen = searchParams.get("modal") === "new"

    const { filters } = useSmartSearch(bomSearchDef)
    const { boms, isLoading: loading, refetch: refetchBoms } = useAllBOMs(filters)

    useEffect(() => {
        if (isNewModalOpen) {
            setIsFormOpen(true)
            setEditingBom(null)
        }
    }, [isNewModalOpen])

    const handleFormClose = (open: boolean) => {
        setIsFormOpen(open)
        if (!open) {
            setEditingBom(null)
            if (isNewModalOpen) {
                const params = new URLSearchParams(searchParams.toString())
                params.delete("modal")
                router.push(`?${params.toString()}`, { scroll: false })
            }
        }
    }

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/production/boms/${id}/`)
            toast.success("Lista de Materiales eliminada correctamente")
            refetchBoms()
        } catch (error) {
            toast.error("Error al eliminar Lista de Materiales")
        }
    })

    const handleDelete = (id: number) => deleteConfirm.requestConfirm(id)

    const handleEdit = async (id: number) => {
        try {
            const response = await api.get(`/production/boms/${id}/`)
            setEditingBom(response.data)
            setIsFormOpen(true)
        } catch (error) {
            toast.error("Error al cargar detalles de la Lista de Materiales")
        }
    }




    const columns: ColumnDef<BOMListItem>[] = [
        {
            accessorKey: "product_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Producto" className="justify-center" />
            ),
            cell: ({ row }) => {
                const bom = row.original;
                return (
                    <div className="flex flex-col items-center gap-1 py-1">
                        <span className="font-medium text-xs leading-tight text-center">{bom.product_name}</span>
                        <div className="flex flex-wrap justify-center gap-1">
                            {bom.product_internal_code && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal opacity-80 uppercase text-center">
                                    {bom.product_internal_code}
                                </Badge>
                            )}
                            {bom.product_code && bom.product_code !== bom.product_internal_code && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1 font-normal opacity-80 uppercase text-center">
                                    {bom.product_code}
                                </Badge>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre / Versión" className="justify-center" />
            ),
            cell: ({ row }) => <div className="text-center">{row.getValue("name")}</div>,
        },
        {
            accessorKey: "lines_count",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Componentes" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <Badge variant="secondary" className="gap-1">
                        <Layers className="h-3 w-3" />
                        {row.getValue("lines_count") || 0}
                    </Badge>
                </div>
            ),
        },
        {
            accessorKey: "total_cost",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Costo Total" className="justify-center" />
            ),
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("total_cost")) || 0
                return <div className="text-center font-mono">
                    {formatCurrency(amount)}
                </div>
            },
        },
        {
            accessorKey: "active",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <DataCell.Status
                        status={row.getValue("active") ? "active" : "inactive"}
                        label={row.getValue("active") ? "Activa" : "Inactiva"}
                    />
                </div>
            ),
        },
        createActionsColumn<BOMListItem>({
            renderActions: (bom) => (
                <>
                    <DataCell.Action
                        icon={Pencil}
                        title="Editar"
                        onClick={() => handleEdit(bom.id!)}
                    />
                    <DataCell.Action
                        icon={Trash2}
                        title="Eliminar"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(bom.id!)}
                    />
                </>
            )
        }),
    ]

    return (
        <div className="space-y-4">

            <div className="pt-4">
                <DataTable
                    columns={columns}
                    data={boms as unknown as BOMListItem[]}
                    isLoading={loading}
                    variant="embedded"
                    defaultPageSize={20}
                    leftAction={<SmartSearchBar searchDef={bomSearchDef} placeholder="Buscar por producto..." className="w-80" />}
                    createAction={<ToolbarCreateButton label="Nueva Lista" href="/production/boms?modal=new" />}
                />
            </div>

            <BOMFormModal
                open={isFormOpen}
                onOpenChange={handleFormClose}
                onSuccess={refetchBoms}
                bomToEdit={editingBom || undefined}
                product={editingBom ? {
                    id: editingBom.product,
                    name: editingBom.product_name,
                    code: editingBom.product_code
                } as unknown as import('@/features/production/types').ProductMinimal : undefined}
            />

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Lista de Materiales"
                description="¿Está seguro de eliminar esta Lista de Materiales? Esta acción no se puede deshacer."
                variant="destructive"
            />
        </div>
    )
}
