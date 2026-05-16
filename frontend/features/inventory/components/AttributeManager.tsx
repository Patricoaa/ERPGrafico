"use client"

import { showApiError } from "@/lib/errors"

import React, { useState, useMemo, useCallback } from "react"
import api from "@/lib/api"
import { Plus, Trash2, Tag, Eye, X } from "lucide-react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { BaseModal } from "@/components/shared/BaseModal"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import type { BulkAction } from "@/components/shared"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { cn } from "@/lib/utils"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { CancelButton, SubmitButton, IconButton, LabeledInput, MultiTagInput, ActionConfirmModal } from "@/components/shared"

interface ProductAttribute {
    id: number
    name: string
    values?: ProductAttributeValue[]
}

interface ProductAttributeValue {
    id: number
    attribute: number
    value: string
}

interface AttributeManagerProps {
    externalOpen?: boolean
    createAction?: React.ReactNode
}

import { useAttributes } from "@/features/inventory/hooks/useAttributes"
import { SmartSearchBar, useSmartSearch } from "@/components/shared"
import { attributeSearchDef } from "../searchDef"

export function AttributeManager({ externalOpen, createAction }: AttributeManagerProps) {
    const { filters } = useSmartSearch(attributeSearchDef)
    const { attributes, isLoading, refetch } = useAttributes({ filters })
    const [isAttrModalOpen, setIsAttrModalOpen] = useState(false)
    const [isValueModalOpen, setIsValueModalOpen] = useState(false)
    const [selectedAttribute, setSelectedAttribute] = useState<ProductAttribute | null>(null)
    const [newAttrName, setNewAttrName] = useState("")
    const [newAttrValues, setNewAttrValues] = useState<string[]>([])
    const [newValueName, setNewValueName] = useState("")
    const [isSaving, setIsSaving] = useState(false)


    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleCloseModal = () => {
        setIsAttrModalOpen(false)
        setSelectedAttribute(null)
        setNewAttrName("")
        setNewAttrValues([])

        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const handleCreateAttribute = async () => {
        if (!newAttrName.trim()) return
        setIsSaving(true)
        try {
            let attrId: number;

            if (selectedAttribute) {
                // Update existing attribute (only name for now)
                await api.patch(`/inventory/attributes/${selectedAttribute.id}/`, { name: newAttrName })
                attrId = selectedAttribute.id;
            } else {
                // Create new attribute
                const res = await api.post("/inventory/attributes/", { name: newAttrName })
                attrId = res.data.id;
            }

            // Create values if there are any new ones
            if (newAttrValues.length > 0) {
                await Promise.all(newAttrValues.map(val =>
                    api.post("/inventory/attribute-values/", {
                        attribute: attrId,
                        value: val
                    })
                ))
            }

            toast.success(selectedAttribute ? "Atributo actualizado" : "Atributo creado")
            handleCloseModal()
            refetch()
        } catch (error) {
            showApiError(error, "Error al guardar atributo")
        } finally {
            setIsSaving(false)
        }
    }

    const addTag = (tag: string) => {
        if (tag && !newAttrValues.includes(tag)) {
            setNewAttrValues([...newAttrValues, tag])
        }
    }

    const removeTag = (tag: string) => {
        setNewAttrValues(newAttrValues.filter(v => v !== tag))
    }

    const handleCreateValue = async () => {
        if (!newValueName.trim() || !selectedAttribute) return
        try {
            await api.post("/inventory/attribute-values/", {
                attribute: selectedAttribute.id,
                value: newValueName
            })
            toast.success("Valor añadido")
            setNewValueName("")
            setIsValueModalOpen(false)
            refetch()
        } catch (error) {
            showApiError(error, "Error al añadir valor")
        }
    }

    const deleteAttrConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/inventory/attributes/${id}/`)
            toast.success("Atributo eliminado")
            refetch()
        } catch (error) {
            showApiError(error, "Error al eliminar")
        }
    })

    const handleDeleteAttribute = useCallback((id: number) => deleteAttrConfirm.requestConfirm(id), [deleteAttrConfirm])

    const deleteValueConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/inventory/attribute-values/${id}/`)
            toast.success("Valor eliminado")
            refetch()
        } catch (error) {
            showApiError(error, "Error al eliminar valor")
        }
    })

    const handleDeleteValue = useCallback((id: number) => deleteValueConfirm.requestConfirm(id), [deleteValueConfirm])

    const columns = useMemo<ColumnDef<ProductAttribute>[]>(() => [
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
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Atributo" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex items-center justify-center gap-2 w-full">
                    <Tag className="h-4 w-4 text-primary opacity-70" />
                    <DataCell.Text className="text-center font-black uppercase text-[12px] tracking-tight">
                        {row.getValue("name")}
                    </DataCell.Text>
                </div>
            ),
        },
        {
            accessorKey: "values",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Valores" className="justify-center" />
            ),
            cell: ({ row }) => {
                const values = row.original.values || []
                return (
                    <div className="flex flex-nowrap justify-center gap-1.5 w-full overflow-x-auto scrollbar-hide py-1">
                        {values.map((val) => (
                            <span
                                key={val.id}
                                className="inline-flex items-center gap-1 h-[22px] px-2.5 text-[10px] font-mono font-black uppercase tracking-widest rounded-full border border-border/50 bg-muted/60 text-muted-foreground"
                            >
                                {val.value}
                                <IconButton
                                    variant="ghost"
                                    className="ml-0.5 h-3.5 w-3.5 p-0 text-muted-foreground hover:text-destructive transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteValue(val.id)
                                    }}
                                    title="Eliminar valor"
                                >
                                    <X className="h-3 w-3" />
                                </IconButton>
                            </span>
                        ))}
                        <IconButton
                            className="h-6 w-6 rounded-full bg-primary/5 hover:bg-primary/20 text-primary transition-all duration-300"
                            onClick={() => {
                                setSelectedAttribute(row.original)
                                setIsValueModalOpen(true)
                            }}
                            title="Añadir valor"
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </IconButton>
                        {values.length === 0 && (
                            <DataCell.Secondary className="text-muted-foreground/40 italic">
                                Sin valores
                            </DataCell.Secondary>
                        )}
                    </div>
                )
            },
        },
        createActionsColumn<ProductAttribute>({
            renderActions: (item) => (
                <>
                    <DataCell.Action
                        icon={Eye}
                        title="Ver/Editar Atributo"
                        color="text-primary"
                        onClick={() => {
                            setSelectedAttribute(item)
                            setNewAttrName(item.name)
                            setIsAttrModalOpen(true)
                        }}
                    />
                    <DataCell.Action
                        icon={Trash2}
                        title="Eliminar Atributo"
                        className="text-destructive"
                        onClick={() => handleDeleteAttribute(item.id)}
                    />
                </>
            ),
        }),
    ], [handleDeleteValue, handleDeleteAttribute])

    const bulkActions = useMemo<BulkAction<ProductAttribute>[]>(() => [
        {
            key: "delete",
            label: "Eliminar",
            icon: Trash2,
            intent: "destructive",
            onClick: async (items) => {
                if (!confirm(`¿Está seguro de que desea eliminar ${items.length} atributos y todos sus valores?`)) return
                try {
                    await Promise.all(items.map(a => api.delete(`/inventory/attributes/${a.id}/`)))
                    toast.success(`${items.length} atributos eliminados`)
                    refetch()
                } catch (error) {
                    showApiError(error, "Error al eliminar los atributos")
                }
            },
        },
    ], [])


    return (
        <div className="space-y-4">

            <DataTable
                columns={columns}
                data={attributes}
                isLoading={isLoading}
                variant="embedded"
                bulkActions={bulkActions}
                createAction={createAction}
                leftAction={<SmartSearchBar searchDef={attributeSearchDef} placeholder="Buscar atributo..." />}
            />

            {/* Modal para Atributo */}
            <BaseModal
                open={isAttrModalOpen || !!externalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCloseModal()
                    } else {
                        setIsAttrModalOpen(true)
                    }
                }}
                title={
                    <div className="flex items-center gap-3">
                        <Tag className="h-5 w-5 text-muted-foreground" />
                        <span>{selectedAttribute ? "Editar Atributo" : "Nuevo Atributo de Variante"}</span>
                    </div>
                }
                description={selectedAttribute ? "Modifica el nombre o añade nuevos valores al atributo." : "Define un nuevo atributo para generar variaciones de producto (ej: Color, Talla)."}
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <CancelButton onClick={handleCloseModal} disabled={isSaving} />
                        <SubmitButton onClick={handleCreateAttribute} loading={isSaving}>
                            {selectedAttribute ? "Guardar Cambios" : "Crear Atributo"}
                        </SubmitButton>
                    </div>
                }
                hideScrollArea={true}
                className={cn("transition-all duration-300", selectedAttribute?.id ? "sm:max-w-[1000px]" : "sm:max-w-[600px]")}
            >
                <div className="flex flex-1 overflow-hidden min-h-[400px]">
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        <div className="space-y-6">
                            <LabeledInput
                                label="Nombre del Atributo (ej: Color, Talla)"
                                required
                                id="attr-name"
                                value={newAttrName}
                                onChange={(e) => setNewAttrName(e.target.value)}
                                placeholder="Escribe el nombre..."
                            />

                            <MultiTagInput
                                label="Nuevos Valores"
                                placeholder="Escribe un valor y pulsa Enter..."
                                values={newAttrValues}
                                onAdd={addTag}
                                onRemove={removeTag}
                                hint="Escribe los valores que deseas añadir (ej: Rojo, Azul) y pulsa Enter."
                            />
                        </div>
                    </div>

                    {/* Right Side: Activity Sidebar */}
                    {selectedAttribute?.id && (
                        <ActivitySidebar
                            entityType="attribute"
                            entityId={selectedAttribute.id}
                            className="h-full border-none"
                            title="Historial"
                        />
                    )}
                </div>
            </BaseModal>

            {/* Modal para Valor */}
            <BaseModal
                open={isValueModalOpen}
                onOpenChange={setIsValueModalOpen}
                title={
                    <div className="flex items-center gap-3">
                        <Plus className="h-5 w-5 text-muted-foreground" />
                        <span>Añadir Valor a {selectedAttribute?.name}</span>
                    </div>
                }
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <CancelButton onClick={() => setIsValueModalOpen(false)} disabled={isSaving} />
                        <SubmitButton onClick={handleCreateValue} loading={isSaving}>
                            Añadir Valor
                        </SubmitButton>
                    </div>
                }
            >
                <div className="space-y-4 py-4">
                    <LabeledInput
                        label="Nombre del Valor (ej: Rojo, XL)"
                        required
                        id="val-name"
                        value={newValueName}
                        onChange={(e) => setNewValueName(e.target.value)}
                        placeholder="Escribe el valor..."
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreateValue()
                        }}
                    />
                </div>
            </BaseModal>

            <ActionConfirmModal
                open={deleteAttrConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteAttrConfirm.cancel() }}
                onConfirm={deleteAttrConfirm.confirm}
                title="Eliminar Atributo"
                description="¿Seguro que deseas eliminar este atributo y todos sus valores?"
                variant="destructive"
            />

            <ActionConfirmModal
                open={deleteValueConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteValueConfirm.cancel() }}
                onConfirm={deleteValueConfirm.confirm}
                title="Eliminar Valor de Atributo"
                description="¿Seguro que deseas eliminar este valor?"
                variant="destructive"
            />
        </div>
    )
}
