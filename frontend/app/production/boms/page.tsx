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
import { BOMFormDialog } from "@/components/production/BOMFormDialog"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

interface BOM {
    id: number
    name: string
    product: number
    product_name: string
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

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de eliminar esta Lista de Materiales?")) return
        try {
            await api.delete(`/production/boms/${id}/`)
            toast.success("BOM eliminado correctamente")
            fetchBoms()
        } catch (error) {
            toast.error("Error al eliminar BOM")
        }
    }

    const handleEdit = async (id: number) => {
        try {
            const response = await api.get(`/production/boms/${id}/`)
            setEditingBom(response.data)
            setIsFormOpen(true)
        } catch (error) {
            toast.error("Error al cargar detalles del BOM")
        }
    }

    useEffect(() => {
        fetchBoms()
    }, [])




    const columns: ColumnDef<BOM>[] = [
        {
            accessorKey: "product_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Producto" />
            ),
            cell: ({ row }) => <div className="font-medium">{row.getValue("product_name")}</div>,
        },
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre / Versión" />
            ),
        },
        {
            accessorKey: "lines_count",
            header: ({ column }) => (
                <div className="text-center"><DataTableColumnHeader column={column} title="Componentes" /></div>
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
                <div className="text-right"><DataTableColumnHeader column={column} title="Costo Total" /></div>
            ),
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("total_cost")) || 0
                return <div className="text-right font-mono">
                    ${amount.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
            },
        },
        {
            accessorKey: "active",
            header: ({ column }) => (
                <div className="text-center"><DataTableColumnHeader column={column} title="Estado" /></div>
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
                    <div className="text-right">
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
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Listas de Materiales (BOM)</h2>
                <div className="flex items-center space-x-2">
                    <Button onClick={() => { setEditingBom(null); setIsFormOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> Nueva Lista
                    </Button>
                </div>
            </div>



            <DataTable columns={columns} data={boms} defaultPageSize={20} />

            <BOMFormDialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSuccess={fetchBoms}
                bomToEdit={editingBom}
                product={editingBom?.product_id || editingBom?.product}
            />
        </div>
    )
}
