"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import api from "@/lib/api"
import { CustomerForm } from "@/components/forms/CustomerForm"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { DataManagement } from "@/components/shared/DataManagement"
import { formatRUT } from "@/lib/utils/format"

interface Customer {
    id: number
    name: string
    tax_id: string
    email: string
    phone: string
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([])
    const [loading, setLoading] = useState(true)
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)

    const fetchCustomers = async () => {
        try {
            const response = await api.get('/sales/customers/')
            setCustomers(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch customers", error)
            toast.error("Error al cargar los clientes.")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de que desea eliminar este cliente?")) return
        try {
            await api.delete(`/sales/customers/${id}/`)
            toast.success("Cliente eliminado correctamente.")
            fetchCustomers()
        } catch (error) {
            console.error("Error deleting customer:", error)
            toast.error("Error al eliminar el cliente.")
        }
    }

    useEffect(() => {
        fetchCustomers()
    }, [])

    const columns: ColumnDef<Customer>[] = [
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
                    <div className="text-sm">{row.original.email}</div>
                    <div className="text-xs text-muted-foreground">{row.original.phone}</div>
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
                            setEditingCustomer(row.original)
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
                <h2 className="text-3xl font-bold tracking-tight">Cartera de Clientes</h2>
                <div className="flex items-center space-x-2">
                    <CustomerForm
                        onSuccess={fetchCustomers}
                        open={isFormOpen && !editingCustomer}
                        onOpenChange={(open) => {
                            setIsFormOpen(open)
                            if (!open) setEditingCustomer(null)
                        }}
                    />
                    {editingCustomer && (
                        <CustomerForm
                            initialData={editingCustomer}
                            open={isFormOpen && !!editingCustomer}
                            onOpenChange={(open) => {
                                setIsFormOpen(open)
                                if (!open) setEditingCustomer(null)
                            }}
                            onSuccess={fetchCustomers}
                        />
                    )}
                </div>
            </div>
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-muted-foreground">Cargando clientes...</div>
                </div>
            ) : (
                <DataTable columns={columns} data={customers} />
            )}
        </div>
    )
}
