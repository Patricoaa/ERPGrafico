"use client"

import { showApiError } from "@/lib/errors"

import React, { useState, useMemo, useCallback } from "react"
import { Plus, Trash2, Tag, Eye, X } from "lucide-react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { BaseModal, DataTable } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { DataCell, createActionsColumn } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import type { BulkAction } from "@/components/shared"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { cn } from "@/lib/utils"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { CancelButton, SubmitButton, IconButton, LabeledInput, MultiTagInput, ActionConfirmModal, FormFooter } from "@/components/shared"

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
    const {
        attributes,
        isLoading,
        refetch,
        saveAttribute,
        deleteAttribute,
        createAttributeValue,
        deleteAttributeValue,
    } = useAttributes({ filters })
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
            // saveAttribute invalida ATTRIBUTES_QUERY_KEY y emite el toast.
            const saved = await saveAttribute({
                id: selectedAttribute?.id ?? null,
                payload: { name: newAttrName },
            })
            const attrId = saved.id

            // Bulk-create de los valores nuevos. Cada createAttributeValue
            // invalidaría ATTRIBUTES_QUERY_KEY individualmente; lo permitimos
            // (TanStack Query agrupa los refetches del mismo queryKey).
            if (newAttrValues.length > 0) {
                await Promise.all(newAttrValues.map(val =>
                    createAttributeValue({ attribute: attrId, value: val })
                ))
            }

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
            await createAttributeValue({ attribute: selectedAttribute.id, value: newValueName })
            toast.success("Valor añadido")
            setNewValueName("")
            setIsValueModalOpen(false)
        } catch (error) {
            showApiError(error, "Error al añadir valor")
        }
    }

    const deleteAttrConfirm = useConfirmAction<number>(async (id) => {
        try {
            await deleteAttribute(id)
            toast.success("Atributo eliminado")
        } catch (error) {
            showApiError(error, "Error al eliminar")
        }
    })

    const handleDeleteAttribute = useCallback((id: number) => deleteAttrConfirm.requestConfirm(id), [deleteAttrConfirm])

    const deleteValueConfirm = useConfirmAction<number>(async (id) => {
        try {
            await deleteAttributeValue(id)
            toast.success("Valor eliminado")
        } catch (error) {
            showApiError(error, "Error al eliminar valor")
        }
    })

    const handleDeleteValue = useCallback((id: number) => deleteValueConfirm.requestConfirm(id), [deleteValueConfirm])

    const bulkDeleteConfirm = useConfirmAction<ProductAttribute[]>(async (items) => {
        try {
            await Promise.all(items.map(a => deleteAttribute(a.id)))
            toast.success(`${items.length} atributos eliminados`)
        } catch (error) {
            showApiError(error, "Error al eliminar los atributos")
            throw error
        }
    })

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
            onClick: async (items) => bulkDeleteConfirm.requestConfirm(items),
        },
    ], [deleteAttribute, bulkDeleteConfirm])

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTable
                    columns={columns}
                    // Safe: Attribute from useAttributes and ProductAttribute are structurally compatible at runtime
                    data={attributes as unknown as ProductAttribute[]}
                    isLoading={isLoading}
                    variant="embedded"
                    bulkActions={bulkActions}
                    createAction={createAction}
                    leftAction={<SmartSearchBar searchDef={attributeSearchDef} placeholder="Buscar atributo..." className="w-full" />}
                />
            </div>

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
                icon={Tag}
                title={selectedAttribute ? "Editar Atributo" : "Nuevo Atributo de Variante"}
                description={selectedAttribute ? "Modifica el nombre o añade nuevos valores al atributo." : "Define un nuevo atributo para generar variaciones de producto (ej: Color, Talla)."}
                footer={
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={handleCloseModal} disabled={isSaving} />
                                <SubmitButton onClick={handleCreateAttribute} loading={isSaving}>
                                    {selectedAttribute ? "Guardar Cambios" : "Crear Atributo"}
                                </SubmitButton>
                            </>
                        }
                    />
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
                icon={Plus}
                title={selectedAttribute?.name ? `Añadir Valor a ${selectedAttribute.name}` : "Añadir Valor"}
                footer={
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => setIsValueModalOpen(false)} disabled={isSaving} />
                                <SubmitButton onClick={handleCreateValue} loading={isSaving}>
                                    Añadir Valor
                                </SubmitButton>
                            </>
                        }
                    />
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

            <ActionConfirmModal
                open={bulkDeleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) bulkDeleteConfirm.cancel() }}
                onConfirm={bulkDeleteConfirm.confirm}
                title="Eliminar Atributos"
                description={`¿Está seguro de que desea eliminar ${bulkDeleteConfirm.payload?.length ?? 0} atributos y todos sus valores?`}
                variant="destructive"
            />
        </div>
    )
}
