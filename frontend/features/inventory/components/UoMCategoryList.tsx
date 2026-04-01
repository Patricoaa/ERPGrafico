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
import { FORM_STYLES } from "@/lib/styles"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { cn } from "@/lib/utils"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

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

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/inventory/uom-categories/${id}/`)
            toast.success("Categoría eliminada")
            fetchCategories()
        } catch (error) {
            toast.error("Error al eliminar (puede estar en uso)")
        }
    })

    const handleDelete = (id: number) => deleteConfirm.requestConfirm(id)

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
                cardMode
                filterColumn="name"
                searchPlaceholder="Buscar por nombre..."
                useAdvancedFilter={true}
            />

            <BaseModal
                open={isModalOpen}
                onOpenChange={(open) => {
                    setIsModalOpen(open)
                    if (!open) onExternalOpenChange?.(false)
                }}
                size={currentCategory.id ? "lg" : "md"}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Ruler className="h-5 w-5 text-primary" />
                        </div>
                        <span>{currentCategory.id ? "Editar Categoría de Medida" : "Nueva Categoría de Medida"}</span>
                    </div>
                }
                description={currentCategory.id ? "Modifique el nombre de la categoría y consulte el historial." : "Define un agrupador para unidades del mismo tipo (ej: Peso, Volumen)."}
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={isSaving}>Guardar</Button>
                    </div>
                }
            >
                <div className="flex flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="cat-name" className={FORM_STYLES.label}>Nombre</Label>
                            <Input
                                id="cat-name"
                                className={FORM_STYLES.input}
                                placeholder="Ej: Peso, Volumen, Unidades"
                                value={currentCategory.name || ''}
                                onChange={e => setCurrentCategory({ ...currentCategory, name: e.target.value })}
                            />
                        </div>
                    </div>

                    {currentCategory.id && (
                        <div className="w-72 border-l bg-muted/5 flex flex-col pt-4 shrink-0 hidden lg:flex">
                            <ActivitySidebar
                                entityId={currentCategory.id}
                                entityType="uom_category"
                            />
                        </div>
                    )}
                </div>
            </BaseModal>

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Categoría"
                description="¿Eliminar categoría? Esto eliminará las unidades asociadas y no se puede deshacer."
                variant="destructive"
            />
        </div>
    )
}
