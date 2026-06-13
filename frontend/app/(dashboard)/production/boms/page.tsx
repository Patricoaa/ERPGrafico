"use client"
import { formatCurrency } from "@/lib/money"

import React, { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { ActionConfirmModal, DataTableColumnHeader, DataTableView, EntityCard, StatusBadge } from '@/components/shared'
import { createActionsColumn, DataCell } from '@/components/shared'
import { Pencil, Trash2, Layers } from "lucide-react"
import api from "@/lib/api"
import { BOMDrawer } from "@/features/production"
import { toast } from "sonner"
import { Chip } from "@/components/shared"

import { ToolbarCreateButton, SmartSearchBar, useSmartSearch } from "@/components/shared"
import { useConfirmAction } from "@/hooks/useConfirmAction"

import { useAllBOMs } from "@/features/production"
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
    const [editingBom, setEditingBom] = useState<BOM | null>(null)
    const searchParams = useSearchParams()
    const router = useRouter()
    const isNewModalOpen = searchParams.get("modal") === "new"

    const { filters, isFiltered } = useSmartSearch(bomSearchDef)
    const { boms, isLoading: loading, refetch: refetchBoms } = useAllBOMs(filters)

    useEffect(() => {
        if (isNewModalOpen) {
            requestAnimationFrame(() => {
                setIsFormOpen(true)
                setEditingBom(null)
            })
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
        } catch {
            toast.error("Error al eliminar Lista de Materiales")
        }
    })

    const handleDelete = (id: number) => deleteConfirm.requestConfirm(id)

    const handleEdit = async (id: number) => {
        try {
            const response = await api.get(`/production/boms/${id}/`)
            setEditingBom(response.data)
            setIsFormOpen(true)
        } catch {
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
                                <Chip size="xs" intent="neutral" className="font-normal opacity-80 text-center">
                                    {bom.product_internal_code}
                                </Chip>
                            )}
                            {bom.product_code && bom.product_code !== bom.product_internal_code && (
                                <Chip size="xs" intent="neutral" className="font-normal opacity-80 text-center">
                                    {bom.product_code}
                                </Chip>
                            )}
                        </div>
                    </div>
                );
            },
            meta: { title: "Producto" },
        },
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre / Versión" className="justify-center" />
            ),
            cell: ({ row }) => <div className="text-center">{row.getValue("name")}</div>,
            meta: { title: "Nombre / Versión" },
        },
        {
            accessorKey: "lines_count",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Componentes" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <Chip size="sm" intent="neutral" className="gap-1">
                        <Layers className="h-3 w-3" />
                        {row.getValue("lines_count") || 0}
                    </Chip>
                </div>
            ),
            meta: { title: "Componentes" },
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
            meta: { title: "Costo Total" },
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
            meta: { title: "Estado" },
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
        <div className="h-full flex flex-col">

            <div className="flex-1 min-h-0">
                <DataTableView
                    columns={columns}
                    data={boms as unknown as BOMListItem[]}
                    isLoading={loading}
                    entityLabel="production.bom"
                    variant="embedded"
                    defaultPageSize={20}
                    leftAction={<SmartSearchBar searchDef={bomSearchDef} placeholder="Buscar por producto..." className="w-full" />}
                    createAction={<ToolbarCreateButton label="Nueva Lista" href="/production/boms?modal=new" />}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: "bom",
                        title: "Aún no hay listas de materiales",
                        description: "Crea una lista de materiales (BOM) para definir cómo se fabrica un producto.",
                    }}
                    renderCard={(bom: BOMListItem) => (
                        <EntityCard onClick={() => handleEdit(bom.id!)}>
                            <EntityCard.Header
                                title={bom.name}
                                subtitle={bom.product_name}
                                trailing={<StatusBadge status={bom.active ? 'active' : 'inactive'} size="sm" />}
                            />
                            <EntityCard.Body>
                                {bom.product_internal_code && (
                                    <EntityCard.Field label="Código" value={<DataCell.Code>{bom.product_internal_code}</DataCell.Code>} />
                                )}
                                <EntityCard.Field label="Componentes" value={<DataCell.Number value={bom.lines_count} />} />
                            </EntityCard.Body>
                        </EntityCard>
                    )}
                />
            </div>

            <BOMDrawer
                open={isFormOpen}
                onOpenChange={handleFormClose}
                onSuccess={refetchBoms}
                bomToEdit={editingBom || undefined}
                product={editingBom ? {
                    id: editingBom.product,
                    name: (editingBom as BOMListItem).product_name,
                    code: (editingBom as BOMListItem).product_code
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
