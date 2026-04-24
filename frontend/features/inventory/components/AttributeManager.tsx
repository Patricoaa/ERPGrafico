"use client"

import { showApiError } from "@/lib/errors"

import React, { useEffect, useState, useMemo } from "react"
import api from "@/lib/api"
import { Plus, Trash2, Tag, LayoutDashboard, Eye, X, Loader2 } from "lucide-react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { BaseModal } from "@/components/shared/BaseModal"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { ColumnDef, RowSelectionState } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { CancelButton, SubmitButton, IconButton, LabeledInput } from "@/components/shared"

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

export function AttributeManager({ externalOpen, createAction }: AttributeManagerProps) {
    const [attributes, setAttributes] = useState<ProductAttribute[]>([])
    const [loading, setLoading] = useState(true)
    const [isAttrModalOpen, setIsAttrModalOpen] = useState(false)
    const [isValueModalOpen, setIsValueModalOpen] = useState(false)
    const [selectedAttribute, setSelectedAttribute] = useState<ProductAttribute | null>(null)
    const [newAttrName, setNewAttrName] = useState("")
    const [newAttrValues, setNewAttrValues] = useState<string[]>([])
    const [tagInput, setTagInput] = useState("")
    const [newValueName, setNewValueName] = useState("")
    const [selectedRows, setSelectedRows] = useState<RowSelectionState>({})
    const [isSaving, setIsSaving] = useState(false)


    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleCloseModal = () => {
        setIsAttrModalOpen(false)
        setSelectedAttribute(null)
        setNewAttrName("")
        setNewAttrValues([])
        setTagInput("")
        
        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    useEffect(() => {
        fetchAttributes()
    }, [])

    const fetchAttributes = async () => {
        setLoading(true)
        try {
            const [attrRes, valRes] = await Promise.all([
                api.get("/inventory/attributes/"),
                api.get("/inventory/attribute-values/")
            ])

            const attrs = attrRes.data.results || attrRes.data
            const vals = valRes.data.results || valRes.data

            const enrichedAttrs = attrs.map((attr: ProductAttribute) => ({
                ...attr,
                values: vals.filter((v: ProductAttributeValue) => v.attribute === attr.id)
            }))

            setAttributes(enrichedAttrs)
        } catch (error) {
            console.error(error)
            showApiError(error, "Error al cargar atributos")
        } finally {
            setLoading(false)
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
            fetchAttributes()
        } catch (error) {
            showApiError(error, "Error al guardar atributo")
        } finally {
            setIsSaving(false)
        }
    }

    const addTag = () => {
        const tag = tagInput.trim()
        if (tag && !newAttrValues.includes(tag)) {
            setNewAttrValues([...newAttrValues, tag])
            setTagInput("")
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
            fetchAttributes()
        } catch (error) {
            showApiError(error, "Error al añadir valor")
        }
    }

    const deleteAttrConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/inventory/attributes/${id}/`)
            toast.success("Atributo eliminado")
            fetchAttributes()
        } catch (error) {
            showApiError(error, "Error al eliminar")
        }
    })

    const handleDeleteAttribute = (id: number) => deleteAttrConfirm.requestConfirm(id)

    const deleteValueConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/inventory/attribute-values/${id}/`)
            toast.success("Valor eliminado")
            fetchAttributes()
        } catch (error) {
            showApiError(error, "Error al eliminar valor")
        }
    })

    const handleDeleteValue = (id: number) => deleteValueConfirm.requestConfirm(id)

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
                            <DataCell.Badge 
                                key={val.id} 
                                variant="secondary" 
                                className="flex items-center gap-1 px-2.5 py-0.5 h-6 text-[10px] font-bold border-secondary/50"
                            >
                                {val.value}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteValue(val.id)
                                    }}
                                    className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                                    title="Eliminar valor"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </DataCell.Badge>
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
    ], [])

    const selectedAttributes = useMemo(() => {
        return attributes.filter((_, index) => selectedRows[index])
    }, [selectedRows, attributes])

    const handleBulkDelete = async () => {
        if (selectedAttributes.length === 0) return
        if (!confirm(`¿Está seguro de que desea eliminar ${selectedAttributes.length} atributos y todos sus valores?`)) return

        try {
            await Promise.all(selectedAttributes.map(a => api.delete(`/inventory/attributes/${a.id}/`)))
            toast.success(`${selectedAttributes.length} atributos eliminados`)
            setSelectedRows({})
            fetchAttributes()
        } catch (error) {
            showApiError(error, "Error al eliminar los atributos")
        }
    }


    return (
        <div className="space-y-4">

            <DataTable
                columns={columns}
                data={attributes}
                cardMode
                isLoading={loading}
                filterColumn="name"
                searchPlaceholder="Buscar atributos..."
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

                            <div className="space-y-3">
                                <p className="text-[10px] text-muted-foreground">Escribe los valores que deseas añadir (ej: Rojo, Azul) y pulsa Enter.</p>
                                <div className="flex gap-2">
                                    <LabeledInput
                                        label="Nuevos Valores"
                                        containerClassName="flex-1"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault()
                                                addTag()
                                            }
                                        }}
                                        placeholder="Ej: Rojo..."
                                    />
                                    <IconButton type="button" onClick={addTag} variant="secondary" className="shrink-0 self-end">
                                        <Plus className="h-4 w-4" />
                                    </IconButton>
                                </div>
                                
                                <div className="flex flex-wrap gap-2 pt-2 min-h-[60px] p-3 rounded-md border border-dashed bg-muted/20">
                                    {newAttrValues.map((tag, i) => (
                                        <DataCell.Badge key={i} variant="secondary" className="flex items-center gap-1.5 py-1 px-2.5 text-xs font-medium animate-in zoom-in-50 duration-200">
                                            {tag}
                                            <button 
                                                type="button" 
                                                onClick={() => removeTag(tag)}
                                                className="hover:text-destructive transition-colors"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </DataCell.Badge>
                                    ))}
                                    {newAttrValues.length === 0 && (
                                        <div className="flex items-center justify-center w-full h-full text-muted-foreground text-[11px] italic">
                                            Lista de nuevos valores vacía
                                        </div>
                                    )}
                                </div>
                            </div>
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
