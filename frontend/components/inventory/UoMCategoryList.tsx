"use client"

import React, { useEffect, useState } from "react"
import api from "@/lib/api"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, Trash2, Ruler } from "lucide-react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface UoMCategory {
    id: number
    name: string
}

interface UoMCategoryListProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
}

export function UoMCategoryList({ externalOpen, onExternalOpenChange }: UoMCategoryListProps) {
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

    useEffect(() => {
        if (externalOpen) {
            setCurrentCategory({})
            setIsModalOpen(true)
        }
    }, [externalOpen])

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
            />

            <BaseModal
                open={isModalOpen}
                onOpenChange={(open) => {
                    setIsModalOpen(open)
                    if (!open) onExternalOpenChange?.(false)
                }}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Ruler className="h-5 w-5 text-primary" />
                        </div>
                        <span>{currentCategory.id ? "Editar Categoría de Medida" : "Nueva Categoría de Medida"}</span>
                    </div>
                }
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={isSaving}>Guardar</Button>
                    </div>
                }
            >
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
            </BaseModal>
        </div>
    )
}
