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
import { WarehouseForm } from "@/components/forms/WarehouseForm"

interface Warehouse {
    id: number
    name: string
    code: string
    address: string
}

export default function WarehousesPage() {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [loading, setLoading] = useState(true)

    const fetchWarehouses = async () => {
        try {
            const response = await api.get('/inventory/warehouses/')
            setWarehouses(response.data)
        } catch (error) {
            console.error("Failed to fetch warehouses", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchWarehouses()
    }, [])

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Almacenes y Bodegas</h2>
                <div className="flex items-center space-x-2">
                    <WarehouseForm onSuccess={fetchWarehouses} />
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Código</TableHead>
                            <TableHead>Dirección</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {warehouses.map((warehouse) => (
                            <TableRow key={warehouse.id}>
                                <TableCell className="font-medium">{warehouse.name}</TableCell>
                                <TableCell>{warehouse.code}</TableCell>
                                <TableCell>{warehouse.address || "-"}</TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center">Cargando almacenes...</TableCell>
                            </TableRow>
                        )}
                        {!loading && warehouses.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center">No hay almacenes registrados.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
