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
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface UoMCategory {
    id: number
    name: string
}

export default function UoMCategoriesPage() {
    const router = useRouter()
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
            toast.error("Error al cargar categorías")
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
            toast.error("Error al guardar")
            console.error(error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("¿Eliminar categoría? Esto eliminará las unidades asociadas.")) return
        try {
            await api.delete(`/inventory/uom-categories/${id}/`)
            toast.success("Categoría eliminada")
            setCategories(prev => prev.filter(c => c.id !== id))
        } catch (error) {
            toast.error("Error al eliminar (puede estar en uso)")
        }
    }

    return (
        <div className="p-8 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-3xl font-bold">Categorías de Medida</h2>
                </div>
                <Button onClick={() => { setCurrentCategory({}); setIsModalOpen(true) }}>
                    <Plus className="mr-2 h-4 w-4" /> Nueva Categoría
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-10 text-muted-foreground italic">Cargando...</TableCell>
                            </TableRow>
                        ) : categories.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-10 text-muted-foreground italic">No hay categorías configuradas.</TableCell>
                            </TableRow>
                        ) : (
                            categories.map(cat => (
                                <TableRow key={cat.id}>
                                    <TableCell className="text-muted-foreground">{cat.id}</TableCell>
                                    <TableCell className="font-medium">{cat.name}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex gap-2 justify-end">
                                            <Button variant="ghost" size="icon" onClick={() => { setCurrentCategory(cat); setIsModalOpen(true) }}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(cat.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{currentCategory.id ? 'Editar' : 'Crear'} Categoría</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="cat-name" className="text-right">Nombre</Label>
                            <Input
                                id="cat-name"
                                className="col-span-3"
                                placeholder="Ej: Peso, Volumen, Unidades"
                                value={currentCategory.name || ''}
                                onChange={e => setCurrentCategory({ ...currentCategory, name: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={isSaving}>Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
