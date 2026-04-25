"use client"

import { showApiError } from "@/lib/errors"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import api from "@/lib/api"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { ColumnDef, RowSelectionState } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { CancelButton, SubmitButton, LabeledInput } from "@/components/shared"
import { Plus, Pencil, Trash2, Ruler } from "lucide-react"
import { BaseModal } from "@/components/shared/BaseModal"
import { toast } from "sonner"
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
    createAction?: React.ReactNode
}

export function UoMCategoryList({ externalOpen, onExternalOpenChange, createAction }: UoMCategoryListProps) {
    const [categories, setCategories] = useState<UoMCategory[]>([])
    const [loading, setLoading] = useState(true)

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedRows, setSelectedRows] = useState<RowSelectionState>({})
    const [currentCategory, setCurrentCategory] = useState<Partial<UoMCategory>>({})
    const [isSaving, setIsSaving] = useState(false)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleCloseModal = () => {
        setIsModalOpen(false)
        setCurrentCategory({})
        onExternalOpenChange?.(false)
        
        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const fetchCategories = async () => {
        setLoading(true)
        try {
            const res = await api.get('/inventory/uom-categories/')
            setCategories(res.data.results || res.data)
        } catch (error) {
            console.error(error)
            showApiError(error, "Error al cargar categorías de medida")
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
            showApiError(error, "Error al guardar")
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
            showApiError(error, "Error al eliminar (puede estar en uso)")
        }
    })

    const handleDelete = (id: number) => deleteConfirm.requestConfirm(id)

    const columns = useMemo<ColumnDef<UoMCategory>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
            size: 40,
        },
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Text className="text-center w-full">
                    {row.getValue("name")}
                </DataCell.Text>
            ),
        },
        createActionsColumn<UoMCategory>({
            renderActions: (item) => (
                <>
                    <DataCell.Action icon={Pencil} title="Editar" onClick={() => { setCurrentCategory(item); setIsModalOpen(true) }} />
                    <DataCell.Action icon={Trash2} title="Eliminar" className="text-destructive" onClick={() => handleDelete(item.id)} />
                </>
            ),
        }),
    ], [])

    const selectedCategories = useMemo(() => {
        return categories.filter((_, index) => selectedRows[index])
    }, [selectedRows, categories])

    const handleBulkDelete = async () => {
        if (selectedCategories.length === 0) return
        if (!confirm(`¿Está seguro de que desea eliminar ${selectedCategories.length} categorías de unidades?`)) return

        try {
            await Promise.all(selectedCategories.map(c => api.delete(`/inventory/uom-categories/${c.id}/`)))
            toast.success(`${selectedCategories.length} categorías eliminadas`)
            setSelectedRows({})
            fetchCategories()
        } catch (error) {
            showApiError(error, "Error al eliminar las categorías (pueden tener unidades asociadas)")
        }
    }


    return (
        <div className="space-y-4">
            <DataTable
                columns={columns}
                data={categories}
                isLoading={loading}
                cardMode
                filterColumn="name"
                pageSizeOptions={[10, 20]}
                useAdvancedFilter={true}
                onRowSelectionChange={setSelectedRows}
                batchActions={
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-destructive-foreground hover:bg-destructive/20 gap-2"
                        onClick={handleBulkDelete}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                    </Button>
                }
                createAction={createAction}
            />

            <BaseModal
                open={isModalOpen || !!externalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCloseModal()
                    } else {
                        setIsModalOpen(true)
                    }
                }}
                size={currentCategory.id ? "lg" : "md"}
                title={
                    <div className="flex items-center gap-3">
                        <Ruler className="h-5 w-5 text-muted-foreground" />
                        <span>{currentCategory.id ? "Editar Categoría de Medida" : "Nueva Categoría de Medida"}</span>
                    </div>
                }
                description={currentCategory.id ? "Modifique el nombre de la categoría y consulte el historial." : "Define un agrupador para unidades del mismo tipo (ej: Peso, Volumen)."}
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <CancelButton onClick={() => setIsModalOpen(false)} disabled={isSaving} />
                        <SubmitButton onClick={handleSave} loading={isSaving}>Guardar</SubmitButton>
                    </div>
                }
            >
                <div className="flex flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        <LabeledInput
                            label="Nombre"
                            required
                            id="cat-name"
                            placeholder="Ej: Peso, Volumen, Unidades"
                            value={currentCategory.name || ''}
                            onChange={e => setCurrentCategory({ ...currentCategory, name: e.target.value })}
                        />
                    </div>

                    {currentCategory.id && (
                        <ActivitySidebar
                                entityId={currentCategory.id}
                                entityType="uom_category"
                            />
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
