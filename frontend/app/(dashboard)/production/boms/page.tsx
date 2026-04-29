"use client"

import React, { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
    ColumnDef
} from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataTable } from "@/components/ui/data-table"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, Trash2, Layers, CheckCircle2, XCircle } from "lucide-react"
import api from "@/lib/api"
import { BOMFormModal } from "@/features/production/components/BOMFormModal"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

import type { BOM } from "@/features/production/types"

interface BOMListItem extends BOM {
    product_name: string
    product_code: string
    product_internal_code?: string
    lines_count: number
    total_cost: number
}
interface BOMsPageProps {
    createAction?: React.ReactNode
}

export default function BOMsPage({ createAction }: BOMsPageProps = {}) {
    const [boms, setBoms] = useState<BOMListItem[]>([])
    const [loading, setLoading] = useState(true)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingBom, setEditingBom] = useState<BOMListItem | null>(null)
    const searchParams = useSearchParams()
    const router = useRouter()
    const isNewModalOpen = searchParams.get("modal") === "new"

    // Modal state sync with URL
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

    const fetchBoms = async () => {
        setLoading(true)
        try {
            const response = await api.get('/production/boms/')
            setBoms(response.data.results || response.data)
        } catch (error) {
            console.error("Error fetching BOMs:", error)
            toast.error("Error al cargar las Listas de Materiales")
        } finally {
            setLoading(false)
        }
    }

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/production/boms/${id}/`)
            toast.success("Lista de Materiales eliminada correctamente")
            fetchBoms()
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

    useEffect(() => {
        fetchBoms()
    }, [])




    const columns: import("@tanstack/react-table").ColumnDef<BOMListItem>[] = [
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
                    data={boms}
                    isLoading={loading}
                    cardMode
                    defaultPageSize={20}
                    filterColumn="product_name"
                    searchPlaceholder="Buscar por producto..."
                    facetedFilters={[
                        {
                            column: "active",
                            title: "Estado",
                            options: [
                                { label: "Activa", value: "true" },
                                { label: "Inactiva", value: "false" },
                            ],
                        },
                    ]}
                    useAdvancedFilter={true}
                    createAction={createAction}
                />
            </div>

            <BOMFormModal
                open={isFormOpen}
                onOpenChange={handleFormClose}
                onSuccess={fetchBoms}
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
