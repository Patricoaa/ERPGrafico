"use client"

import { useEffect, useState } from "react"
import {
    ColumnDef
} from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Pencil, Trash2, Layers, CheckCircle2, XCircle } from "lucide-react"
import api from "@/lib/api"
import { BOMFormDialog } from "@/features/production/components/BOMFormDialog"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

interface BOM {
    id: number
    name: string
    product: number
    product_name: string
    product_code: string
    product_internal_code?: string
    active: boolean
    lines_count: number
    total_cost: number
}

export default function BOMsPage() {
    const [boms, setBoms] = useState<BOM[]>([])
    const [loading, setLoading] = useState(true)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingBom, setEditingBom] = useState<any | null>(null)

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




    const columns: ColumnDef<BOM>[] = [
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
                    {row.getValue("active") ? (
                        <Badge className="bg-green-600 hover:bg-green-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Activa
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                            <XCircle className="h-3 w-3 mr-1" /> Inactiva
                        </Badge>
                    )}
                </div>
            ),
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const bom = row.original
                return (
                    <div className="text-center">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(bom.id)}
                            title="Editar"
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(bom.id)}
                            title="Eliminar"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )
            },
        },
    ]

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Listas de Materiales"
                description="Gestión de estructuras de productos y costos de fabricación."
                titleActions={
                    <Button
                        size="icon"
                        className="rounded-full h-8 w-8"
                        onClick={() => { setEditingBom(null); setIsFormOpen(true); }}
                        title="Nueva Lista"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                }
            />



            <div className="">
                <DataTable
                    columns={columns}
                    data={boms}
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
                />
            </div>

            <BOMFormDialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSuccess={fetchBoms}
                bomToEdit={editingBom}
                product={editingBom?.product_id || editingBom?.product}
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
