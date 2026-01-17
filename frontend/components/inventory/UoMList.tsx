"use client"

import React, { useEffect, useState } from "react"
import api from "@/lib/api"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

interface UoMCategory {
    id: number
    name: string
}

interface UoM {
    id: number
    name: string
    category: number
    category_name: string
    uom_type: 'REFERENCE' | 'BIGGER' | 'SMALLER'
    ratio: string
    rounding: string
    active: boolean
}

export function UoMList() {
    const [uoms, setUoMs] = useState<UoM[]>([])
    const [categories, setCategories] = useState<UoMCategory[]>([])
    const [loading, setLoading] = useState(true)

    // Modal State
    const [isUoMModalOpen, setIsUoMModalOpen] = useState(false)
    const [currentUoM, setCurrentUoM] = useState<Partial<UoM>>({})
    const [isSaving, setIsSaving] = useState(false)

    const fetchData = async () => {
        setLoading(true)
        try {
            const [resUoMs, resCats] = await Promise.all([
                api.get('/inventory/uoms/'),
                api.get('/inventory/uom-categories/')
            ])
            setUoMs(resUoMs.data.results || resUoMs.data)
            setCategories(resCats.data.results || resCats.data)
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar unidades de medida")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleSaveUoM = async () => {
        setIsSaving(true)
        try {
            if (currentUoM.id) {
                await api.put(`/inventory/uoms/${currentUoM.id}/`, currentUoM)
                toast.success("Unidad actualizada")
            } else {
                await api.post('/inventory/uoms/', currentUoM)
                toast.success("Unidad creada")
            }
            setIsUoMModalOpen(false)
            fetchData()
        } catch (error) {
            toast.error("Error al guardar")
            console.error(error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("¿Eliminar unidad de medida?")) return
        try {
            await api.delete(`/inventory/uoms/${id}/`)
            toast.success("Eliminada correctamente")
            fetchData()
        } catch (error) {
            toast.error("No se puede eliminar (puede estar en uso)")
        }
    }

    const columns: ColumnDef<UoM>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
            cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
        },
        {
            accessorKey: "category_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Categoría" />,
            cell: ({ row }) => <div className="text-sm">{row.getValue("category_name")}</div>,
        },
        {
            accessorKey: "uom_type",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
            cell: ({ row }) => {
                const type = row.getValue("uom_type")
                return (
                    <div>
                        {type === 'REFERENCE' && <Badge variant="default" className="text-[10px]">Referencia</Badge>}
                        {type === 'BIGGER' && <Badge variant="secondary" className="text-[10px]">Mayor</Badge>}
                        {type === 'SMALLER' && <Badge variant="outline" className="text-[10px]">Menor</Badge>}
                    </div>
                )
            },
        },
        {
            accessorKey: "ratio",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Ratio" className="justify-end" />,
            cell: ({ row }) => <div className="text-right font-mono text-xs tabular-nums text-muted-foreground">{parseFloat(row.getValue("ratio")).toString()}</div>,
        },
        {
            id: "actions",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Acciones" className="text-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setCurrentUoM(row.original); setIsUoMModalOpen(true) }}>
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
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Unidades de Medida</h3>
                <Button onClick={() => { setCurrentUoM({ active: true, ratio: "1.00000", rounding: "0.01000", uom_type: "REFERENCE" }); setIsUoMModalOpen(true) }}>
                    <Plus className="mr-2 h-4 w-4" /> Nueva Unidad
                </Button>
            </div>

            <div className="">
                <DataTable
                    columns={columns}
                    data={uoms}
                    filterColumn="name"
                    searchPlaceholder="Buscar unidad..."
                />
            </div>

            <Dialog open={isUoMModalOpen} onOpenChange={setIsUoMModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{currentUoM.id ? 'Editar' : 'Crear'} Unidad de Medida</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Nombre</Label>
                            <Input
                                className="col-span-3"
                                placeholder="Ej: Kilogramo, Metro, Litro"
                                value={currentUoM.name || ''}
                                onChange={e => setCurrentUoM({ ...currentUoM, name: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Categoría</Label>
                            <Select
                                value={currentUoM.category?.toString()}
                                onValueChange={(val) => setCurrentUoM({ ...currentUoM, category: parseInt(val) })}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Seleccionar categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map(cat => (
                                        <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Tipo</Label>
                            <Select
                                value={currentUoM.uom_type}
                                onValueChange={(val: any) => setCurrentUoM({ ...currentUoM, uom_type: val })}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="REFERENCE">Referencia (Base de la categoría)</SelectItem>
                                    <SelectItem value="BIGGER">Más Grande que la base</SelectItem>
                                    <SelectItem value="SMALLER">Más Pequeña que la base</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {currentUoM.uom_type !== 'REFERENCE' && (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Ratio</Label>
                                <Input
                                    className="col-span-3"
                                    type="number"
                                    step="0.00001"
                                    value={currentUoM.ratio || ''}
                                    onChange={e => setCurrentUoM({ ...currentUoM, ratio: e.target.value })}
                                />
                                <p className="col-start-2 col-span-3 text-[10px] text-muted-foreground italic">
                                    {currentUoM.uom_type === 'BIGGER'
                                        ? 'Cuántas unidades base equivalen a esta unidad'
                                        : 'Cuántas unidades de estas equivalen a la unidad base'}
                                </p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsUoMModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveUoM} disabled={isSaving}>
                            {isSaving ? "Guardando..." : "Guardar Unidad"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
