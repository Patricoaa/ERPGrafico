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
    Plus, Edit, Trash2, Check, X, Loader2, Workflow, Box, Layers, Copy
} from "lucide-react"
import { BOMFormDialog } from "./BOMFormDialog"
import api from "@/lib/api"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { DataCell } from "@/components/ui/data-table-cells"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface BOMManagerProps {
    product: any
    variantMode?: boolean
    onBomsChange?: (boms: any[]) => void
}

export function BOMManager({ product, variantMode = false, onBomsChange }: BOMManagerProps) {
    const [boms, setBoms] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingBom, setEditingBom] = useState<any>(null)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [bomToDelete, setBomToDelete] = useState<any>(null)

    // Variant support
    const [variants, setVariants] = useState<any[]>([])
    const [selectedVariantId, setSelectedVariantId] = useState<string>("all")
    const [variantsLoading, setVariantsLoading] = useState(false)

    const fetchBoms = async () => {
        if (!product?.id) return
        setLoading(true)
        try {
            const params: any = {}
            if (selectedVariantId && selectedVariantId !== "all") {
                params.product_id = selectedVariantId
            } else {
                params.parent_id = product.id
            }
            
            const res = await api.get(`/production/boms/`, { params })
            setBoms(res.data)
            onBomsChange?.(res.data)
        } catch (error) {
            console.error("Error fetching BOMs:", error)
            toast.error("Error al cargar listas de materiales")
        } finally {
            setLoading(false)
        }
    }

    // Fetch variants
    useEffect(() => {
        const loadVariants = async () => {
            if (product?.has_variants) {
                setVariantsLoading(true)
                try {
                    const res = await api.get(`/inventory/products/?parent_template=${product.id}&show_technical_variants=true`)
                    setVariants(res.data.results || res.data)
                } catch (e) {
                    console.error("Error loading variants", e)
                } finally {
                    setVariantsLoading(false)
                }
            } else {
                setVariants([])
            }
        }
        loadVariants()
    }, [product])

    useEffect(() => {
        fetchBoms()
    }, [product, selectedVariantId])

    const handleCreate = () => {
        setEditingBom(null)
        setDialogOpen(true)
    }

    const handleEdit = (bom: any) => {
        setEditingBom(bom)
        setDialogOpen(true)
    }

    const handleClone = (bom: any) => {
        // Clone but remove IDs to trigger creation
        const cloned = {
            ...bom,
            id: undefined,
            name: `${bom.name} (Copia)`,
            // Keep the lines but they'll be processed by the dialog
        }
        setEditingBom(cloned)
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
            toast.success("Lista de Materiales eliminada")
            setIsDeleteModalOpen(false)
            fetchBoms()
        } catch (error) {
            console.error("Error deleting BOM:", error)
            toast.error("Error al eliminar Lista de Materiales")
        }
    }

    const handleToggleActive = async (bom: any) => {
        if (bom.active) return

        try {
            await api.patch(`/production/boms/${bom.id}/`, { active: true })
            toast.success("Lista de Materiales establecida como activa")
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
        <div className={cn("w-full", variantMode && "bg-transparent")}>
            {!variantMode && (
                <div className="pb-3 px-4 pt-4 border-b">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-bold flex items-center gap-2">
                                <Workflow className="h-5 w-5 text-primary" />
                                Listas de Materiales
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Defina los componentes necesarios para fabricar este producto.
                            </p>
                        </div>
                    </div>

                    {product?.has_variants && (
                        <div className="mt-4 bg-primary/5 p-4 rounded-2xl border border-primary/10 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="p-2 bg-primary/10 rounded-xl">
                                        <Layers className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <Label className="text-xs font-bold uppercase tracking-wider text-primary">Gestionar Receta por Variante</Label>
                                        <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Seleccione una variante para configurar su proceso propio.</p>
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col md:flex-row items-center gap-3">
                                    <Select
                                        value={selectedVariantId}
                                        onValueChange={setSelectedVariantId}
                                    >
                                        <SelectTrigger className="w-full md:w-[320px] h-10 bg-white shadow-soft rounded-xl border-primary/20">
                                            <SelectValue placeholder="Seleccione variante..." />
                                        </SelectTrigger>
                                        <SelectContent align="start" className="rounded-xl">
                                            <SelectItem value="all" className="font-bold text-primary">
                                                -- Ver Todas las Recetas --
                                            </SelectItem>
                                            {variants.map(v => (
                                                <SelectItem key={v.id} value={v.id.toString()}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-[10px] bg-muted px-1 rounded">{v.internal_code || v.code}</span>
                                                        <span>{v.variant_display_name || v.name}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleCreate()
                                        }}
                                        className="w-full md:w-auto gap-2 rounded-xl font-bold shadow-soft"
                                        disabled={selectedVariantId === "all"}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Configurar Receta
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {(!product?.has_variants) && (
                        <div className="flex justify-end mt-2">
                            <Button
                                type="button"
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
                    )}
                </div>
            )}

            {variantMode && (
                <div className="flex justify-between items-center mb-4 px-2">
                    <div className="flex items-center gap-2">
                        <Workflow className="h-4 w-4 text-primary" />
                        <span className="font-bold text-sm">Recetas de esta variante</span>
                    </div>
                    <Button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            handleCreate()
                        }}
                        size="sm"
                        variant="outline"
                        className="h-8 gap-2 rounded-xl text-xs font-bold border-primary/20 hover:bg-primary/5"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Añadir Receta
                    </Button>
                </div>
            )}
            <div className="p-4">
                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-[20%]">Nombre</TableHead>
                                <TableHead className="w-[15%]">Variante / Producto</TableHead>
                                <TableHead className="w-[15%]">Rendimiento</TableHead>
                                <TableHead className="w-[12%] text-center">Estado</TableHead>
                                <TableHead className="w-[10%] text-center">Items</TableHead>
                                <TableHead className="w-[13%] text-right">Actualizado</TableHead>
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
                                    <TableCell colSpan={6} className="text-center py-12">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-3 bg-muted/50 rounded-full">
                                                <Workflow className="h-8 w-8 text-muted-foreground/50" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-bold text-muted-foreground">No hay recetas definidas {selectedVariantId !== "all" ? "para esta variante" : "aún"}</p>
                                                <p className="text-xs text-muted-foreground">Para comenzar a fabricar, debe definir los componentes necesarios.</p>
                                            </div>
                                            <div className="flex gap-2 mt-4">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="rounded-xl border-primary/20 hover:bg-primary/5 h-8 text-xs font-bold"
                                                    onClick={handleCreate}
                                                >
                                                    Crear Nueva Receta
                                                </Button>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                boms.map((bom) => (
                                    <TableRow key={bom.id} className="hover:bg-muted/5">
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <DataCell.Text className="font-bold">{bom.name}</DataCell.Text>
                                                {bom.notes && (
                                                    <DataCell.Secondary className="max-w-[200px] line-clamp-1">{bom.notes}</DataCell.Secondary>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {bom.product_id === product.id ? (
                                                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground bg-muted/30 border-dashed">Base</Badge>
                                                ) : (
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-mono text-primary font-bold">{bom.product_internal_code || 'VAR'}</span>
                                                        <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">{bom.product_name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <DataCell.Text className="font-bold text-emerald-700">
                                                    {bom.yield_quantity} {bom.yield_uom_name || product.uom_name}
                                                </DataCell.Text>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {bom.active ? (
                                                <DataCell.Badge variant="success" className="gap-1 pl-1 pr-2">
                                                    <Check className="h-3 w-3" /> Activa
                                                </DataCell.Badge>
                                            ) : (
                                                <DataCell.Badge
                                                    variant="outline"
                                                    className="text-muted-foreground cursor-pointer hover:bg-emerald-100 hover:text-emerald-700 hover:border-emerald-200 transition-colors"
                                                >
                                                    <span onClick={() => handleToggleActive(bom)} title="Clic para activar">Inactiva</span>
                                                </DataCell.Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center text-sm">
                                            {bom.lines?.length || 0} ítems
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DataCell.Date value={bom.updated_at} className="text-muted-foreground" />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Clonar Receta"
                                                    className="h-8 w-8 hover:text-emerald-600 hover:bg-emerald-50"
                                                    onClick={() => handleClone(bom)}
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Editar"
                                                    className="h-8 w-8 hover:text-blue-600 hover:bg-blue-50"
                                                    onClick={() => handleEdit(bom)}
                                                >
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Eliminar"
                                                    className="h-8 w-8 hover:text-red-600 hover:bg-red-50"
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
            </div>

            <BOMFormDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                product={
                    (selectedVariantId && selectedVariantId !== "all")
                        ? variants.find(v => v.id.toString() === selectedVariantId) || product
                        : product
                }
                bomToEdit={editingBom}
                onSuccess={fetchBoms}
            />

            <ActionConfirmModal
                open={isDeleteModalOpen}
                onOpenChange={setIsDeleteModalOpen}
                title="Eliminar Lista de Materiales"
                variant="destructive"
                onConfirm={() => { if (bomToDelete) return handleDelete(bomToDelete, true) }}
                confirmText="Eliminar Lista de Materiales"
                description={
                    <p>
                        ¿Está seguro de que desea eliminar la lista de materiales <strong>{bomToDelete?.name}</strong>?
                        Esta acción no se puede deshacer y el producto dejará de tener esta receta de fabricación definida.
                    </p>
                }
            />
        </div>
    )
}
