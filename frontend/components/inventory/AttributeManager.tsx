"use client"

import React, { useEffect, useState } from "react"
import api from "@/lib/api"
import { Plus, Pencil, Trash2, Tag, ListFilter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

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
    onExternalOpenChange?: (open: boolean) => void
}

export function AttributeManager({ externalOpen, onExternalOpenChange }: AttributeManagerProps) {
    const [attributes, setAttributes] = useState<ProductAttribute[]>([])
    const [loading, setLoading] = useState(true)
    const [isAttrModalOpen, setIsAttrModalOpen] = useState(false)
    const [isValueModalOpen, setIsValueModalOpen] = useState(false)
    const [selectedAttribute, setSelectedAttribute] = useState<ProductAttribute | null>(null)
    const [newAttrName, setNewAttrName] = useState("")
    const [newValueName, setNewValueName] = useState("")

    useEffect(() => {
        if (externalOpen) {
            setIsAttrModalOpen(true)
            onExternalOpenChange?.(false)
        }
    }, [externalOpen, onExternalOpenChange])

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
        try {
            await api.delete(`/inventory/attribute-values/${id}/`)
            toast.success("Valor eliminado")
            fetchAttributes()
        } catch (error) {
            toast.error("Error al eliminar valor")
        }
    }

    return (
        <div className="space-y-6">

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {attributes.map((attr) => (
                    <Card key={attr.id} className="overflow-hidden border-2 border-primary/5 hover:border-primary/20 transition-all">
                        <CardHeader className="bg-muted/30 pb-4">
                            <div className="flex justify-between items-center text-primary-foreground">
                                <CardTitle className="flex items-center gap-2">
                                    <Tag className="h-5 w-5 text-primary" />
                                    {attr.name}
                                </CardTitle>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteAttribute(attr.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="flex flex-wrap gap-2 mb-4 min-h-[40px]">
                                {attr.values?.map((val) => (
                                    <Badge key={val.id} variant="secondary" className="flex items-center gap-1 py-1 px-3 group">
                                        {val.value}
                                        <button onClick={() => handleDeleteValue(val.id)} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                        </button>
                                    </Badge>
                                ))}
                                {(!attr.values || attr.values.length === 0) && (
                                    <p className="text-xs text-muted-foreground italic">Sin valores definidos</p>
                                )}
                            </div>
                            <Button
                                variant="outline"
                                className="w-full border-dashed"
                                onClick={() => {
                                    setSelectedAttribute(attr)
                                    setIsValueModalOpen(true)
                                }}
                            >
                                <Plus className="mr-2 h-3 w-3" />
                                Añadir Valor
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Modal para Atributo */}
            <Dialog open={isAttrModalOpen} onOpenChange={setIsAttrModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Crear Nuevo Atributo</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
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
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAttrModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateAttribute}>Crear</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal para Valor */}
            <Dialog open={isValueModalOpen} onOpenChange={setIsValueModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Añadir Valor a {selectedAttribute?.name}</DialogTitle>
                    </DialogHeader>
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
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsValueModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateValue}>Añadir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
