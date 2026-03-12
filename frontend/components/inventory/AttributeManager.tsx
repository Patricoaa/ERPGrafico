"use client"

import React, { useEffect, useState } from "react"
import api from "@/lib/api"
import { Plus, Trash2, Tag, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { BaseModal } from "@/components/shared/BaseModal"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table" // Ensure this is installed/available
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { ActivitySidebar } from "@/components/audit/ActivitySidebar"

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
    // Props are no longer needed for external control if PageHeader is inside, 
    // but keeping them optional just in case or for future flexibility won't hurt, 
    // although we are removing the externalOpen logic from page.tsx.
    // For this refactor, we will remove them to clean up since the page no longer passes them.
}

export function AttributeManager() {
    const [attributes, setAttributes] = useState<ProductAttribute[]>([])
    const [loading, setLoading] = useState(true)
    const [isAttrModalOpen, setIsAttrModalOpen] = useState(false)
    const [isValueModalOpen, setIsValueModalOpen] = useState(false)
    const [selectedAttribute, setSelectedAttribute] = useState<ProductAttribute | null>(null)
    const [newAttrName, setNewAttrName] = useState("")
    const [newValueName, setNewValueName] = useState("")

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
            toast.error("Error al cargar atributos")
        } finally {
            setLoading(false)
        }
    }

    const handleCreateAttribute = async () => {
        if (!newAttrName.trim()) return
        try {
            await api.post("/inventory/attributes/", { name: newAttrName })
            toast.success("Atributo creado")
            setNewAttrName("")
            setIsAttrModalOpen(false)
            fetchAttributes()
        } catch (error) {
            toast.error("Error al crear atributo")
        }
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
            toast.error("Error al añadir valor")
        }
    }

    const handleDeleteAttribute = async (id: number) => {
        if (!confirm("¿Seguro que deseas eliminar este atributo y todos sus valores?")) return
        try {
            await api.delete(`/inventory/attributes/${id}/`)
            toast.success("Atributo eliminado")
            fetchAttributes()
        } catch (error) {
            toast.error("Error al eliminar")
        }
    }

    const handleDeleteValue = async (id: number) => {
        if (!confirm("¿Seguro que deseas eliminar este valor?")) return
        try {
            await api.delete(`/inventory/attribute-values/${id}/`)
            toast.success("Valor eliminado")
            fetchAttributes()
        } catch (error) {
            toast.error("Error al eliminar valor")
        }
    }

    const columns: ColumnDef<ProductAttribute>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Atributo" />
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-2 font-medium">
                    <Tag className="h-4 w-4 text-primary" />
                    {row.getValue("name")}
                </div>
            ),
        },
        {
            accessorKey: "values",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Valores" />
            ),
            cell: ({ row }) => {
                const values = row.original.values || []
                return (
                    <div className="flex flex-wrap gap-1">
                        {values.map((val) => (
                            <Badge key={val.id} variant="secondary" className="flex items-center gap-1 group">
                                {val.value}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteValue(val.id)
                                    }}
                                    className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                                    title="Eliminar valor"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                        {values.length === 0 && <span className="text-muted-foreground text-xs italic">Sin valores</span>}
                    </div>
                )
            },
        },
        {
            id: "actions",
            header: () => <div className="text-center">Acciones</div>,
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSelectedAttribute(row.original)
                            setIsValueModalOpen(true)
                        }}
                        className="h-8"
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        Valor
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAttribute(row.original.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive/90"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="space-y-6">
            <PageHeader
                title="Atributos de Variantes"
                description="Gestiona los atributos y valores para productos con variaciones."
                titleActions={
                    <PageHeaderButton
                        onClick={() => setIsAttrModalOpen(true)}
                        icon={Plus}
                        circular
                        title="Nuevo Atributo"
                    />
                }
            />

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-muted-foreground">Cargando atributos...</div>
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={attributes}
                    filterColumn="name"
                    searchPlaceholder="Buscar atributos..."
                    useAdvancedFilter={true}
                />
            )}

            {/* Modal para Atributo */}
            <BaseModal
                open={isAttrModalOpen}
                onOpenChange={setIsAttrModalOpen}
            title={
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Tag className="h-5 w-5 text-primary" />
                    </div>
                    <span>{selectedAttribute ? "Ficha de Atributo" : "Nuevo Atributo"}</span>
                </div>
            }
            footer={
                <div className="flex justify-end gap-2 w-full">
                    <Button variant="outline" onClick={() => setIsAttrModalOpen(false)}>Cancelar</Button>
                    <Button onClick={handleCreateAttribute}>Crear Atributo</Button>
                </div>
            }
            hideScrollArea={true}
            className="sm:max-w-[700px] h-[500px]"
        >
            <div className="flex flex-1 overflow-hidden h-full">
                <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="attr-name">Nombre (ej: Color, Talla)</Label>
                        <Input
                            id="attr-name"
                            value={newAttrName}
                            onChange={(e) => setNewAttrName(e.target.value)}
                            placeholder="Escribe el nombre..."
                        />
                    </div>
                </div>

                {/* Right Side: Activity Sidebar */}
                {selectedAttribute && (
                    <div className="w-[300px] border-l flex flex-col bg-muted/10 shrink-0">
                        <ActivitySidebar
                            entityType="attribute"
                            entityId={selectedAttribute.id}
                            className="h-full border-none"
                            title="Historial"
                        />
                    </div>
                )}
            </div>
        </BaseModal>

            {/* Modal para Valor */}
            <BaseModal
                open={isValueModalOpen}
                onOpenChange={setIsValueModalOpen}
            title={
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Plus className="h-5 w-5 text-primary" />
                    </div>
                    <span>Añadir Valor a {selectedAttribute?.name}</span>
                </div>
            }
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <Button variant="outline" onClick={() => setIsValueModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateValue}>Añadir Valor</Button>
                    </div>
                }
            >
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="val-name">Nombre del Valor (ej: Rojo, XL)</Label>
                        <Input
                            id="val-name"
                            value={newValueName}
                            onChange={(e) => setNewValueName(e.target.value)}
                            placeholder="Escribe el valor..."
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleCreateValue()
                            }}
                        />
                    </div>
                </div>
            </BaseModal>
        </div>
    )
}
