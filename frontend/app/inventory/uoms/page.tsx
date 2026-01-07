"use client"

import React, { useEffect, useState } from "react"
import api from "@/lib/api"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

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

export default function UoMPage() {
    const router = useRouter()
    const [uoms, setUoMs] = useState<UoM[]>([])
    const [categories, setCategories] = useState<UoMCategory[]>([])
    const [loading, setLoading] = useState(true)

    // Modal State
    const [isUoMModalOpen, setIsUoMModalOpen] = useState(false)
    const [currentUoM, setCurrentUoM] = useState<Partial<UoM>>({})
    const [isSaving, setIsSaving] = useState(false)

    // Category Modal (Simple)
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
    const [currentCategory, setCurrentCategory] = useState<Partial<UoMCategory>>({})

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
            toast.error("Error al cargar datos")
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
            // Refresh
            const res = await api.get('/inventory/uoms/')
            setUoMs(res.data.results || res.data)
        } catch (error) {
            toast.error("Error al guardar")
            console.error(error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Eliminar unidad?")) return
        try {
            await api.delete(`/inventory/uoms/${id}/`)
            toast.success("Eliminada")
            setUoMs(prev => prev.filter(u => u.id !== id))
        } catch (error) {
            toast.error("No se puede eliminar (en uso?)")
        }
    }

    return (
        <div className="p-8 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-3xl font-bold">Unidades de Medida</h2>
                </div>
                <Button onClick={() => { setCurrentUoM({ active: true, ratio: "1.00000", rounding: "0.01000", uom_type: "REFERENCE" }); setIsUoMModalOpen(true) }}>
                    <Plus className="mr-2 h-4 w-4" /> Nueva Unidad
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Ratio</TableHead>
                            <TableHead>Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {uoms.map(u => (
                            <TableRow key={u.id}>
                                <TableCell className="font-medium">{u.name}</TableCell>
                                <TableCell>{u.category_name}</TableCell>
                                <TableCell>
                                    {u.uom_type === 'REFERENCE' && <span className="font-bold text-primary">Referencia</span>}
                                    {u.uom_type === 'BIGGER' && 'Más Grande'}
                                    {u.uom_type === 'SMALLER' && 'Más Pequeña'}
                                </TableCell>
                                <TableCell>{parseFloat(u.ratio).toString()}</TableCell>
                                <TableCell>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => { setCurrentUoM(u); setIsUoMModalOpen(true) }}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(u.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isUoMModalOpen} onOpenChange={setIsUoMModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{currentUoM.id ? 'Editar' : 'Crear'} Unidad</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Nombre</Label>
                            <Input
                                className="col-span-3"
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
                                    <SelectItem value="REFERENCE">Referencia</SelectItem>
                                    <SelectItem value="BIGGER">Más Grande</SelectItem>
                                    <SelectItem value="SMALLER">Más Pequeña</SelectItem>
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
                            </div>
                        )}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Redondeo</Label>
                            <Input
                                className="col-span-3"
                                type="number"
                                step="0.00001"
                                value={currentUoM.rounding || ''}
                                onChange={e => setCurrentUoM({ ...currentUoM, rounding: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsUoMModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveUoM} disabled={isSaving}>Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
