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
                        {suppliers.map((supplier) => (
                            <TableRow key={supplier.id}>
                                <TableCell className="font-medium">{supplier.name}</TableCell>
                                <TableCell>{supplier.tax_id ? formatRUT(supplier.tax_id) : 'S/Rut'}</TableCell>
                                <TableCell>
                                    <div className="font-medium">{supplier.contact_name}</div>
                                    <div className="text-xs text-muted-foreground">{supplier.email}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-center space-x-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                setEditingSupplier(supplier)
                                                setIsFormOpen(true)
                                            }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(supplier.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center">Cargando proveedores...</TableCell>
                            </TableRow>
                        )}
                        {!loading && suppliers.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center">No hay proveedores registrados.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
