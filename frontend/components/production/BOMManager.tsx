"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card"
import {
    Plus, Edit, Trash2, Check, X, Loader2, Workflow, Box
} from "lucide-react"
import { BOMFormDialog } from "./BOMFormDialog"
import api from "@/lib/api"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface BOMManagerProps {
    product: any
}

export function BOMManager({ product }: BOMManagerProps) {
    const [boms, setBoms] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingBom, setEditingBom] = useState<any>(null)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [bomToDelete, setBomToDelete] = useState<any>(null)

    const fetchBoms = async () => {
        if (!product?.id) return
        setLoading(true)
        try {
            const res = await api.get(`/production/boms/?product_id=${product.id}`)
            setBoms(res.data)
        } catch (error) {
            console.error("Error fetching BOMs:", error)
            toast.error("Error al cargar listas de materiales")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchBoms()
    }, [product])

    const handleCreate = () => {
        setEditingBom(null)
        setDialogOpen(true)
    }

    const handleEdit = (bom: any) => {
        setEditingBom(bom)
        setDialogOpen(true)
    }

    const handleDelete = async (bom: any, isConfirmed = false) => {
        if (!bom) return

        if (!isConfirmed) {
            setBomToDelete(bom)
            setIsDeleteModalOpen(true)
            return
        }

        try {
            await api.delete(`/production/boms/${bom.id}/`)
            toast.success("BOM eliminada")
            setIsDeleteModalOpen(false)
            fetchBoms()
        } catch (error) {
            console.error("Error deleting BOM:", error)
            toast.error("Error al eliminar BOM")
        }
    }

    const handleToggleActive = async (bom: any) => {
        if (bom.active) return // Already active, do nothing (cannot deactivate the only active one easily without activating another, logic handles usually setting one as active)

        try {
            // Setting this one to active will automatically deactivate others via backend model logic
            await api.patch(`/production/boms/${bom.id}/`, { active: true })
            toast.success("BOM establecida como activa")
            fetchBoms()
        } catch (error) {
            console.error("Error updating BOM:", error)
            toast.error("Error al actualizar estado")
        }
    }

    if (!product?.id) {
        return (
            <div className="p-8 text-center border rounded-xl bg-muted/20 text-muted-foreground">
                <Box className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Guarde el producto primero para gestionar sus listas de materiales.</p>
            </div>
        )
    }

    return (
        <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Workflow className="h-5 w-5 text-primary" />
                            Listas de Materiales (BOM)
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                            Defina los componentes necesarios para fabricar este producto.
                        </CardDescription>
                    </div>
                    <Button
                        onClick={(e) => {
                            e.stopPropagation()
                            handleCreate()
                        }}
                        size="sm"
                        className="gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Nueva Lista
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-[40%]">Nombre</TableHead>
                                <TableHead className="w-[15%] text-center">Estado</TableHead>
                                <TableHead className="w-[15%] text-center">Componentes</TableHead>
                                <TableHead className="w-[15%] text-right">Actualizado</TableHead>
                                <TableHead className="w-[15%] text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : boms.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No hay listas de materiales definidas.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                boms.map((bom) => (
                                    <TableRow key={bom.id} className="hover:bg-muted/5">
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span>{bom.name}</span>
                                                {bom.notes && (
                                                    <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{bom.notes}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {bom.active ? (
                                                <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 gap-1 pl-1 pr-2">
                                                    <Check className="h-3 w-3" /> Activa
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className="text-muted-foreground cursor-pointer hover:bg-emerald-100 hover:text-emerald-700 hover:border-emerald-200 transition-colors"
                                                    onClick={() => handleToggleActive(bom)}
                                                    title="Clic para activar"
                                                >
                                                    Inactiva
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center text-sm">
                                            {bom.lines?.length || 0} ítems
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">
                                            {format(new Date(bom.updated_at), "dd/MM/yyyy", { locale: es })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 hover:text-blue-600"
                                                    onClick={() => handleEdit(bom)}
                                                >
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 hover:text-red-600"
                                                    onClick={() => handleDelete(bom)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            <BOMFormDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                product={product}
                bomToEdit={editingBom}
                onSuccess={fetchBoms}
            />

            <ActionConfirmModal
                open={isDeleteModalOpen}
                onOpenChange={setIsDeleteModalOpen}
                title="Eliminar Lista de Materiales"
                variant="destructive"
                onConfirm={() => { if (bomToDelete) return handleDelete(bomToDelete, true) }}
                confirmText="Eliminar BOM"
                description={
                    <p>
                        ¿Está seguro de que desea eliminar la lista de materiales <strong>{bomToDelete?.name}</strong>?
                        Esta acción no se puede deshacer y el producto dejará de tener esta receta de fabricación definida.
                    </p>
                }
            />
        </Card>
    )
}
