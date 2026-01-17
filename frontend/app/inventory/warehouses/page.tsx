"use client"

import { useEffect, useState } from "react"
import {
    ColumnDef
} from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import api from "@/lib/api"
import { WarehouseForm } from "@/components/forms/WarehouseForm"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface Warehouse {
    id: number
    name: string
    code: string
    address: string
}

export default function WarehousesPage() {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [loading, setLoading] = useState(true)
    const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)

    const fetchWarehouses = async () => {
        try {
            const response = await api.get('/inventory/warehouses/')
            setWarehouses(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch warehouses", error)
            toast.error("Error al cargar los almacenes.")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de que desea eliminar este almacén?")) return
        try {
            await api.delete(`/inventory/warehouses/${id}/`)
            toast.success("Almacén eliminado correctamente.")
            fetchWarehouses()
        } catch (error) {
            console.error("Error deleting warehouse:", error)
            toast.error("Error al eliminar el almacén.")
        }
    }

    useEffect(() => {
        fetchWarehouses()
    }, [])


    const columns: ColumnDef<Warehouse>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre" />
            ),
            cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
        },
        {
            accessorKey: "code",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Código" />
            ),
        },
        {
            accessorKey: "address",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Dirección" />
            ),
            cell: ({ row }) => <div>{row.getValue("address") || "-"}</div>,
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const warehouse = row.original
                return (
                    <div className="flex justify-center space-x-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                setEditingWarehouse(warehouse)
                                setIsFormOpen(true)
                            }}
                            title="Editar"
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(warehouse.id)}
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
                <h2 className="text-3xl font-bold tracking-tight">Almacenes</h2>
                <div className="flex items-center space-x-2">
                    <WarehouseForm
                        onSuccess={fetchWarehouses}
                        open={isFormOpen && !editingWarehouse}
                        onOpenChange={(open) => {
                            setIsFormOpen(open)
                            if (!open) setEditingWarehouse(null)
                        }}
                    />
                    {editingWarehouse && (
                        <WarehouseForm
                            initialData={editingWarehouse}
                            open={isFormOpen && !!editingWarehouse}
                            onOpenChange={(open) => {
                                setIsFormOpen(open)
                                if (!open) setEditingWarehouse(null)
                            }}
                            onSuccess={fetchWarehouses}
                        />
                    )}
                </div>
            </div>
            <div className="">
                <DataTable
                    columns={columns}
                    data={warehouses}
                    defaultPageSize={20}
                    filterColumn="name"
                    searchPlaceholder="Buscar por nombre..."
                />
            </div>
        </div>
    )
}
