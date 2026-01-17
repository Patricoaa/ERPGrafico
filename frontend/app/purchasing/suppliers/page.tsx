"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import api from "@/lib/api"
import { SupplierForm } from "@/components/forms/SupplierForm"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { DataManagement } from "@/components/shared/DataManagement"
import { formatRUT } from "@/lib/utils/format"

interface Supplier {
    id: number
    name: string
    tax_id: string
    contact_name: string
    email: string
    phone: string
}

export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [loading, setLoading] = useState(true)
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)

    const fetchSuppliers = async () => {
        try {
            const response = await api.get('/purchasing/suppliers/')
            setSuppliers(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch suppliers", error)
            toast.error("Error al cargar los proveedores.")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de que desea eliminar este proveedor?")) return
        try {
            await api.delete(`/purchasing/suppliers/${id}/`)
            toast.success("Proveedor eliminado correctamente.")
            fetchSuppliers()
        } catch (error) {
            console.error("Error deleting supplier:", error)
            toast.error("Error al eliminar el proveedor.")
        }
    }

    useEffect(() => {
        fetchSuppliers()
    }, [])

    const columns: ColumnDef<Supplier>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Razón Social" />
            ),
            cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
        },
        {
            accessorKey: "tax_id",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="RUT" />
            ),
            cell: ({ row }) => (
                <div>{row.original.tax_id ? formatRUT(row.original.tax_id) : 'S/Rut'}</div>
            ),
        },
        {
            id: "contact",
            header: "Contacto",
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.original.contact_name}</div>
                    <div className="text-xs text-muted-foreground">{row.original.email}</div>
                </div>
            ),
        },
        {
            id: "actions",
            header: () => <div className="text-center">Acciones</div>,
            cell: ({ row }) => (
                <div className="flex justify-center space-x-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            setEditingSupplier(row.original)
                            setIsFormOpen(true)
                        }}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(row.original.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Proveedores</h2>
                <div className="flex items-center space-x-2">
                    <SupplierForm
                        onSuccess={fetchSuppliers}
                        open={isFormOpen && !editingSupplier}
                        onOpenChange={(open) => {
                            setIsFormOpen(open)
                            if (!open) setEditingSupplier(null)
                        }}
                    />
                    {editingSupplier && (
                        <SupplierForm
                            initialData={editingSupplier}
                            open={isFormOpen && !!editingSupplier}
                            onOpenChange={(open) => {
                                setIsFormOpen(open)
                                if (!open) setEditingSupplier(null)
                            }}
                            onSuccess={fetchSuppliers}
                        />
                    )}
                </div>
            </div>
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-muted-foreground">Cargando proveedores...</div>
                </div>
            ) : (
                <DataTable columns={columns} data={suppliers} />
            )}
        </div>
    )
}
