"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import api from "@/lib/api"
import { WarehouseForm } from "./WarehouseForm"
import { Pencil, Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { cn } from "@/lib/utils"

interface Warehouse {
    id: number
    name: string
    code: string
    address: string
}

interface WarehouseListProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
}

export function WarehouseList({ externalOpen, onExternalOpenChange }: WarehouseListProps) {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [loading, setLoading] = useState(true)
    const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleCloseModal = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("modal")
        router.push(`${pathname}?${params.toString()}`)
    }

    const fetchWarehouses = async () => {
        setLoading(true)
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

    useEffect(() => {
        if (externalOpen) {
            setEditingWarehouse(null)
            setIsFormOpen(true)
        }
    }, [externalOpen])

    const columns = useMemo<ColumnDef<Warehouse>[]>(() => [
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre del Almacén" />,
            cell: ({ row }) => (
                <div className="flex flex-col py-1">
                    <span className="font-black text-[12px] uppercase tracking-tight text-foreground/80">{row.original.name}</span>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">Ubicación Física</span>
                </div>
            ),
        },
        {
            accessorKey: "code",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
            cell: ({ row }) => (
                <span className="font-mono text-[10px] font-black uppercase text-primary bg-primary/5 px-2 py-0.5 rounded-[0.125rem] border border-primary/10">
                    {row.original.code}
                </span>
            ),
            size: 120,
        },
        {
            accessorKey: "address",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Dirección" />,
            cell: ({ row }) => (
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight opacity-70 truncate max-w-[200px] block">
                    {row.original.address || "-"}
                </span>
            ),
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex justify-end gap-1">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors" 
                        onClick={() => { setEditingWarehouse(row.original); setIsFormOpen(true) }}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors" 
                        onClick={() => handleDelete(row.original)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
            size: 80,
        },
    ], [])

    return (
        <div className="space-y-6">
            <DataTable
                columns={columns}
                data={warehouses}
                cardMode
                title="Gestión de Almacenes"
                isLoading={loading}
                useAdvancedFilter={true}
                filterColumn="name"
                searchPlaceholder="Buscar almacén por nombre o código..."
                globalFilterFields={["name", "code", "address"]}
                toolbarAction={
                    <div className="flex items-center gap-2">
                        <Button 
                            onClick={() => { setEditingWarehouse(null); setIsFormOpen(true); }}
                            className="h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-[0.25rem] shadow-lg shadow-primary/20 group"
                        >
                             <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform" /> 
                             Nuevo almacén
                        </Button>
                    </div>
                }
            />

            <WarehouseForm
                onSuccess={fetchWarehouses}
                open={isFormOpen}
                onOpenChange={(open) => {
                    setIsFormOpen(open)
                    if (!open) {
                        setEditingWarehouse(null)
                        onExternalOpenChange?.(false)
                        handleCloseModal()
                    }
                }}
                initialData={editingWarehouse}
            />

            <ActionConfirmModal
                open={isDeleteModalOpen}
                onOpenChange={setIsDeleteModalOpen}
                title="Eliminar Almacén"
                variant="destructive"
                onConfirm={() => { if (warehouseToDelete) return handleDelete(warehouseToDelete, true) }}
                confirmText="Eliminar permanentemente"
                description={
                    <div className="space-y-3">
                        <p className="text-sm font-medium">
                            ¿Confirma la eliminación del almacén <span className="font-black text-foreground underline">{warehouseToDelete?.name}</span>?
                        </p>
                        <p className="text-[11px] text-muted-foreground bg-destructive/5 border border-destructive/10 p-3 rounded-md">
                             <strong className="text-destructive uppercase">Advertencia:</strong> Esta acción es irreversible y podría afectar la integridad de los stocks registrados en esta ubicación.
                        </p>
                    </div>
                }
            />
        </div >
    )
}
