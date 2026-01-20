"use client"

import React, { useEffect, useState } from "react"
import api from "@/lib/api"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, Trash2 } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface UoMCategory {
    id: number
    name: string
}

export function UoMCategoryList() {
    const [categories, setCategories] = useState<UoMCategory[]>([])
    const [loading, setLoading] = useState(true)

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [currentCategory, setCurrentCategory] = useState<Partial<UoMCategory>>({})
    const [isSaving, setIsSaving] = useState(false)

    const fetchCategories = async () => {
        setLoading(true)
        try {
            const res = await api.get('/inventory/uom-categories/')
            setCategories(res.data.results || res.data)
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar categorías de medida")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCategories()
    }, [])

    const handleSave = async () => {
        if (!currentCategory.name) {
            toast.error("El nombre es requerido")
            return
        }
        setIsSaving(true)
        try {
            if (currentCategory.id) {
                await api.put(`/inventory/uom-categories/${currentCategory.id}/`, currentCategory)
                toast.success("Categoría actualizada")
            } else {
                await api.post('/inventory/uom-categories/', currentCategory)
                toast.success("Categoría creada")
            }
            setIsModalOpen(false)
            fetchCategories()
        } catch (error) {
            toast.error("Error al guardar")
            console.error(error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("¿Eliminar categoría? Esto eliminará las unidades asociadas.")) return
        try {
            await api.delete(`/inventory/uom-categories/${id}/`)
            toast.success("Categoría eliminada")
            fetchCategories()
        } catch (error) {
            toast.error("Error al eliminar (puede estar en uso)")
        }
    }

    const columns: ColumnDef<UoMCategory>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
            cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
        },
        {
            id: "actions",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Acciones" className="text-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setCurrentCategory(row.original); setIsModalOpen(true) }}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(row.original.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="space-y-4">
            <DataTable
                columns={columns}
                data={categories}
                filterColumn="name"
                searchPlaceholder="Buscar categoría..."
                useAdvancedFilter={true}
                toolbarAction={
                    <Button onClick={() => { setCurrentCategory({}); setIsModalOpen(true) }} size="sm">
                        <Plus className="mr-2 h-4 w-4" /> Nueva Categoría
                    </Button>
                }
            />

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{currentCategory.id ? 'Editar' : 'Crear'} Categoría de Medida</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="cat-name" className="text-right">Nombre</Label>
                            <Input
                                id="cat-name"
                                className="col-span-3"
                                placeholder="Ej: Peso, Volumen, Unidades"
                                value={currentCategory.name || ''}
                                onChange={e => setCurrentCategory({ ...currentCategory, name: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={isSaving}>Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
