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

    const fetchSuppliers = async () => {
        try {
            const response = await api.get('/purchasing/suppliers/')
            setSuppliers(response.data)
        } catch (error) {
            console.error("Failed to fetch suppliers", error)
        } finally {
            setLoading(false)
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
                    <SupplierForm onSuccess={fetchSuppliers} />
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Razón Social</TableHead>
                            <TableHead>RUT/Tax ID</TableHead>
                            <TableHead>Contacto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {suppliers.map((supplier) => (
                            <TableRow key={supplier.id}>
                                <TableCell className="font-medium">{supplier.name}</TableCell>
                                <TableCell>{supplier.tax_id}</TableCell>
                                <TableCell>
                                    <div className="font-medium">{supplier.contact_name}</div>
                                    <div className="text-xs text-muted-foreground">{supplier.email}</div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center">Cargando proveedores...</TableCell>
                            </TableRow>
                        )}
                        {!loading && suppliers.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center">No hay proveedores registrados.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
