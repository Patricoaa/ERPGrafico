"use client"

import { useEffect, useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import api from "@/lib/api"
import { CustomerForm } from "@/components/forms/CustomerForm"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { DataManagement } from "@/components/shared/DataManagement"

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
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Razón Social</TableHead>
                            <TableHead>RUT</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead className="w-[100px] text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {customers.map((customer) => (
                            <TableRow key={customer.id}>
                                <TableCell className="font-medium">{customer.name}</TableCell>
                                <TableCell>{customer.tax_id}</TableCell>
                                <TableCell>
                                    <div className="text-sm">{customer.email}</div>
                                    <div className="text-xs text-muted-foreground">{customer.phone}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-center space-x-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                setEditingCustomer(customer)
                                                setIsFormOpen(true)
                                            }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(customer.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center">Cargando clientes...</TableCell>
                            </TableRow>
                        )}
                        {!loading && customers.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center">No hay clientes registrados.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
