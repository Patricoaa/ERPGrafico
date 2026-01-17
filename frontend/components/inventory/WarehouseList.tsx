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
import { Pencil, Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

interface Warehouse {
    id: number
    name: string
    code: string
    address: string
}

export function WarehouseList() {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [loading, setLoading] = useState(true)
    const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null)

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

    const handleDelete = async (warehouse: Warehouse | null, isConfirmed = false) => {
        if (!warehouse) return

        if (!isConfirmed) {
            setWarehouseToDelete(warehouse)
            setIsDeleteModalOpen(true)
            return
        }

        try {
            await api.delete(`/inventory/warehouses/${warehouse.id}/`)
            toast.success("Almacén eliminado correctamente.")
            setIsDeleteModalOpen(false)
            fetchWarehouses()
        } catch (error) {
            console.error("Error deleting warehouse:", error)
            toast.error("Error al eliminar el almacén.")
        }
    }

    useEffect(() => {
        fetchWarehouses()
    }, [])

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Gestión de Almacenes</h3>
                <Button onClick={() => setIsFormOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Nuevo Almacén
                </Button>
            </div>

            <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Código</TableHead>
                            <TableHead>Dirección</TableHead>
                            <TableHead className="w-[100px] text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {warehouses.map((warehouse) => (
                            <TableRow key={warehouse.id} className="group hover:bg-muted/20 transition-colors">
                                <TableCell className="font-medium">{warehouse.name}</TableCell>
                                <TableCell className="font-mono text-xs">{warehouse.code}</TableCell>
                                <TableCell className="text-sm">{warehouse.address || "-"}</TableCell>
                                <TableCell>
                                    <div className="flex justify-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => {
                                                setEditingWarehouse(warehouse)
                                                setIsFormOpen(true)
                                            }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive"
                                            onClick={() => handleDelete(warehouse)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow><TableCell colSpan={4} className="text-center py-10">Cargando almacenes...</TableCell></TableRow>
                        )}
                        {!loading && warehouses.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-center py-10 italic text-muted-foreground">No hay almacenes registrados.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <WarehouseForm
                onSuccess={fetchWarehouses}
                open={isFormOpen}
                onOpenChange={(open) => {
                    setIsFormOpen(open)
                    if (!open) setEditingWarehouse(null)
                }}
                initialData={editingWarehouse}
            />

            <ActionConfirmModal
                open={isDeleteModalOpen}
                onOpenChange={setIsDeleteModalOpen}
                title="Eliminar Almacén"
                variant="destructive"
                onConfirm={() => { if (warehouseToDelete) return handleDelete(warehouseToDelete, true) }}
                confirmText="Eliminar"
                description={
                    <p>
                        ¿Está seguro de que desea eliminar el almacén <strong>{warehouseToDelete?.name}</strong>?
                        Esta acción podría afectar los stocks registrados en esta ubicación.
                    </p>
                }
            />
        </div>
    )
}
