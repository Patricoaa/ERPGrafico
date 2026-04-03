"use client"

import React, { useEffect, useState, useMemo } from "react"
import api from "@/lib/api"
import { Plus, Trash2, Tag, LayoutDashboard } from "lucide-react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
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
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

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
}

export function AttributeManager({ externalOpen }: AttributeManagerProps) {
    const [attributes, setAttributes] = useState<ProductAttribute[]>([])
    const [loading, setLoading] = useState(true)
    const [isAttrModalOpen, setIsAttrModalOpen] = useState(false)
    const [isValueModalOpen, setIsValueModalOpen] = useState(false)
    const [selectedAttribute, setSelectedAttribute] = useState<ProductAttribute | null>(null)
    const [newAttrName, setNewAttrName] = useState("")
    const [newValueName, setNewValueName] = useState("")

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleCloseModal = () => {
        setIsAttrModalOpen(false)
        setSelectedAttribute(null)
        
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

    const deleteAttrConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/inventory/attributes/${id}/`)
            toast.success("Atributo eliminado")
            fetchAttributes()
        } catch (error) {
            toast.error("Error al eliminar")
        }
    })

    const handleDeleteAttribute = (id: number) => deleteAttrConfirm.requestConfirm(id)

    const deleteValueConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/inventory/attribute-values/${id}/`)
            toast.success("Valor eliminado")
            fetchAttributes()
        } catch (error) {
            toast.error("Error al eliminar valor")
        }
    })

    const handleDeleteValue = (id: number) => deleteValueConfirm.requestConfirm(id)

    const columns = useMemo<ColumnDef<ProductAttribute>[]>(() => [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Atributo" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex items-center justify-center gap-2 font-medium">
                    <Tag className="h-4 w-4 text-primary" />
                    <span className="text-center">{row.getValue("name")}</span>
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
                    <div className="flex flex-wrap justify-center gap-1">
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
                        {values.length === 0 && <span className="text-muted-foreground text-xs italic text-center w-full">Sin valores</span>}
                    </div>
                )
            },
        },
        {
            id: "actions",
            header: () => <div className="text-center">Acciones</div>,
            cell: ({ row }) => (
                <div className="flex justify-center gap-2">
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
    ], [])


    return (
        <div className="space-y-4">

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-muted-foreground">Cargando atributos...</div>
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={attributes}
                    cardMode
                    isLoading={loading}
                    filterColumn="name"
                    searchPlaceholder="Buscar atributos..."
                    useAdvancedFilter={true}
                />
            )}

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
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Tag className="h-5 w-5 text-primary" />
                        </div>
                        <span>Nuevo Atributo de Variante</span>
                    </div>
                }
                description="Define un nuevo atributo para generar variaciones de producto (ej: Color, Talla)."
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <Button variant="outline" onClick={() => { setIsAttrModalOpen(false); setSelectedAttribute(null); }}>Cancelar</Button>
                        <Button onClick={handleCreateAttribute}>Crear Atributo</Button>
                    </div>
                }
                hideScrollArea={true}
                className={cn("transition-all duration-300", selectedAttribute?.id ? "sm:max-w-[1000px]" : "sm:max-w-[600px]")}
            >
                <div className="flex flex-1 overflow-hidden min-h-[400px]">
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="attr-name" className={FORM_STYLES.label}>Nombre (ej: Color, Talla)</Label>
                            <Input
                                id="attr-name"
                                value={newAttrName}
                                onChange={(e) => setNewAttrName(e.target.value)}
                                placeholder="Escribe el nombre..."
                                className={FORM_STYLES.input}
                            />
                        </div>
                    </div>

                    {/* Right Side: Activity Sidebar */}
                    {selectedAttribute?.id && (
                        <div className="w-[300px] border-l flex flex-col bg-muted/5 shrink-0 pt-4 hidden lg:flex">
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
                        <Label htmlFor="val-name" className={FORM_STYLES.label}>Nombre del Valor (ej: Rojo, XL)</Label>
                        <Input
                            id="val-name"
                            value={newValueName}
                            onChange={(e) => setNewValueName(e.target.value)}
                            placeholder="Escribe el valor..."
                            className={FORM_STYLES.input}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleCreateValue()
                            }}
                        />
                    </div>
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
