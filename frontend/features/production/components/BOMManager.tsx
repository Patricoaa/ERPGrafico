"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Plus, Edit, Trash2, Check, Loader2, Workflow, Box, Layers, Copy
} from "lucide-react"
import { BOMFormDialog } from "./BOMFormDialog"
import api from "@/lib/api"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { DataCell } from "@/components/ui/data-table-cells"

import { BOM, ProductMinimal } from "../types"

interface BOMManagerProps {
    product: ProductMinimal | null
    variantMode?: boolean
    onBomsChange?: (boms: BOM[]) => void
}

export function BOMManager({ product, variantMode = false, onBomsChange }: BOMManagerProps) {
    const [boms, setBoms] = useState<BOM[]>([])
    const [loading, setLoading] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingBom, setEditingBom] = useState<BOM | undefined>(undefined)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [bomToDelete, setBomToDelete] = useState<BOM | undefined>(undefined)

    // Variant support
    const [variants, setVariants] = useState<any[]>([])
    const [selectedVariantId, setSelectedVariantId] = useState<string>("all")

    const fetchBoms = async () => {
        if (!product?.id) return
        setLoading(true)
        try {
            const params: Record<string, string | number> = {}
            if (selectedVariantId && selectedVariantId !== "all") {
                params.product_id = selectedVariantId
            } else if (product?.id) {
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
                try {
                    const res = await api.get(`/inventory/products/?parent_template=${product.id}&show_technical_variants=true`)
                    setVariants(res.data.results || res.data)
                } catch (e) {
                    console.error("Error loading variants", e)
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
        setEditingBom(undefined)
        setDialogOpen(true)
    }

    const handleEdit = (bom: BOM) => {
        setEditingBom(bom)
        setDialogOpen(true)
    }

    const handleClone = (bom: BOM) => {
        const cloned: BOM = {
            ...bom,
            id: undefined,
            name: `${bom.name} (Copia)`,
        }
        setEditingBom(cloned)
        setDialogOpen(true)
    }

    const handleDelete = async (bom: BOM | null, isConfirmed = false) => {
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

    const handleToggleActive = async (bom: BOM) => {
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
            <div className="p-12 text-center border-2 border-dashed rounded-[0.25rem] bg-muted/5 text-muted-foreground animate-in fade-in zoom-in-95 duration-500">
                <Box className="h-10 w-10 mx-auto mb-4 opacity-30 text-primary" />
                <h3 className="text-sm font-black uppercase text-primary tracking-widest leading-none mb-1">Producto no guardado</h3>
                <p className="text-[10px] font-medium uppercase tracking-tight">Guarde los cambios iniciales para gestionar su estructura técnica.</p>
            </div>
        )
    }

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "name",
            header: "Lista de Materiales (Receta)",
            cell: ({ row }) => (
                <div className="flex flex-col py-1">
                    <span className="font-black text-[12px] tracking-tight uppercase leading-none">{row.original.name}</span>
                    {row.original.notes && (
                        <span className="text-[10px] text-muted-foreground italic truncate max-w-[200px] mt-1 pr-4">{row.original.notes}</span>
                    )}
                </div>
            )
        },
        {
            accessorKey: "product_id",
            header: "Variante / Contexto",
            cell: ({ row }) => {
                const isBase = row.original.product_id === product.id
                return (
                    <div className="flex items-center gap-2">
                        {isBase ? (
                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-primary/5 text-primary border-primary/20 h-5 px-1.5 rounded-[0.125rem]">
                                BASE
                            </Badge>
                        ) : (
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] font-mono font-black text-primary/80 bg-primary/5 px-1 rounded-[0.125rem] border border-primary/10 w-fit leading-none py-0.5">
                                    {row.original.product_internal_code || 'VAR'}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[120px]">{row.original.product_name}</span>
                            </div>
                        )}
                    </div>
                )
            }
        },
        {
            accessorKey: "yield_quantity",
            header: () => <div className="text-right whitespace-nowrap">Rendimiento (Output)</div>,
            cell: ({ row }) => (
                <div className="text-right">
                    <span className="font-black font-mono text-[11px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded-[0.125rem] border border-emerald-200/50">
                        {row.original.yield_quantity} {row.original.yield_uom_name || product.uom_name}
                    </span>
                </div>
            )
        },
        {
            accessorKey: "active",
            header: () => <div className="text-center">Estado</div>,
            cell: ({ row }) => (
                <div className="flex justify-center">
                    {row.original.active ? (
                        <Badge className="h-5 px-2 bg-success text-white font-black text-[9px] uppercase tracking-widest rounded-[0.125rem] shadow-sm">
                            <Check className="h-2.5 w-2.5 mr-1" /> ACTIVA
                        </Badge>
                    ) : (
                        <Badge
                            variant="outline"
                            className="h-5 px-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 cursor-pointer hover:bg-success/10 hover:text-success hover:border-success/20 transition-all rounded-[0.125rem]"
                            onClick={() => handleToggleActive(row.original)}
                            title="Haz clic para activar como receta principal"
                        >
                            INACTIVA
                        </Badge>
                    )}
                </div>
            )
        },
        {
            accessorKey: "lines_count",
            header: () => <div className="text-center">Comp.</div>,
            cell: ({ row }) => (
                <div className="text-center text-[10px] font-black opacity-60">
                    {row.original.lines?.length || 0} ITEMS
                </div>
            )
        },
        {
            accessorKey: "updated_at",
            header: () => <div className="text-right">Actualizado</div>,
            cell: ({ row }) => (
                <div className="text-right">
                    <DataCell.Date value={row.original.updated_at} className="text-[10px] font-medium opacity-50" />
                </div>
            )
        },
        {
            id: "actions",
            header: () => <div className="text-right pr-4">Opciones</div>,
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-1 pr-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Clonar Receta"
                        className="h-7 w-7 text-success hover:bg-success/10 rounded-[0.125rem]"
                        onClick={() => handleClone(row.original)}
                    >
                        <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        className="h-7 w-7 text-primary hover:bg-primary/5 rounded-[0.125rem]"
                        onClick={() => handleEdit(row.original)}
                    >
                        <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Eliminar"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-[0.125rem]"
                        onClick={() => handleDelete(row.original)}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            )
        }
    ]

    return (
        <div className={cn("w-full space-y-4", variantMode && "bg-transparent")}>
            {!variantMode && (
                <div className="pb-4 px-4 pt-4 border-b-2">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2 leading-none">
                                <Workflow className="h-4 w-4 text-primary opacity-50" />
                                Estructuras Técnicas (BOM)
                            </h3>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground mt-1.5 opacity-60">
                                Gestión de fórmulas y procesos de fabricación
                            </p>
                        </div>
                    </div>

                    {product?.has_variants && (
                        <div className="mt-4 bg-primary/5 p-5 rounded-[0.25rem] border-2 border-primary/20 shadow-sm transition-all hover:shadow-md animate-in fade-in slide-in-from-top-2 duration-500">
                            <div className="flex flex-col md:flex-row md:items-center gap-6">
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="p-2.5 bg-primary/10 rounded-[0.125rem]">
                                        <Layers className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <Label className="text-[11px] font-black uppercase tracking-widest text-primary leading-none">Contexto de Manufactura</Label>
                                        <p className="text-[9px] font-bold text-muted-foreground leading-none mt-1 uppercase tracking-tighter">Seleccione variante para configurar proceso propio.</p>
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col md:flex-row items-center gap-4">
                                    <Select
                                        value={selectedVariantId}
                                        onValueChange={setSelectedVariantId}
                                    >
                                        <SelectTrigger className="w-full md:w-[360px] h-10 bg-background font-mono shadow-sm rounded-[0.125rem] border-2 border-primary/20 ring-primary/20 focus:ring-2">
                                            <SelectValue placeholder="Seleccione variante..." />
                                        </SelectTrigger>
                                        <SelectContent align="start" className="rounded-[0.125rem] border-2">
                                            <SelectItem value="all" className="font-black text-[10px] uppercase tracking-widest text-primary hover:bg-primary/5">
                                                -- Ver Todas las Recetas --
                                            </SelectItem>
                                            {variants.map(v => (
                                                <SelectItem key={v.id} value={v.id.toString()} className="text-[10px]">
                                                    <div className="flex items-center gap-3 font-bold uppercase">
                                                        <span className="font-mono bg-muted text-[9px] px-1.5 py-0.5 rounded-[0.125rem] border">{v.internal_code || v.code}</span>
                                                        <span className="opacity-80">{v.variant_display_name || v.name}</span>
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
                                        className="w-full md:w-auto h-10 px-6 gap-2 rounded-[0.125rem] font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5"
                                        disabled={selectedVariantId === "all"}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Configurar Receta
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {variantMode && (
                <div className="flex justify-between items-center mb-4 px-2">
                    <div className="flex items-center gap-2">
                        <Workflow className="h-4 w-4 text-primary opacity-50" />
                        <span className="font-black uppercase text-[10px] tracking-widest text-primary">Recetas de esta variante</span>
                    </div>
                    <Button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            handleCreate()
                        }}
                        className="h-8 gap-2 rounded-[0.125rem] text-[10px] font-black uppercase tracking-widest border-2 border-primary/20 hover:bg-primary/5 text-primary"
                        variant="outline"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Añadir Receta
                    </Button>
                </div>
            )}

            <div className="p-0">
                <DataTable 
                    columns={columns}
                    data={boms}
                    isLoading={loading}
                    cardMode={true}
                    toolbarAction={!product?.has_variants && (
                        <Button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                handleCreate()
                            }}
                            className="h-8 px-4 text-[10px] font-black uppercase tracking-widest transition-all rounded-[0.125rem]"
                        >
                            <Plus className="h-3.5 w-3.5 mr-2" />
                            Nueva Lista
                        </Button>
                    )}
                />
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
                    <div className="space-y-3 pt-2">
                        <p className="text-sm font-bold uppercase tracking-tight">
                            ¿Está seguro de que desea eliminar la receta <strong>{bomToDelete?.name}</strong>?
                        </p>
                        <p className="text-[11px] font-medium text-muted-foreground bg-destructive/5 p-3 border-l-4 border-destructive">
                            Esta acción no se puede deshacer y el producto perderá esta definición técnica de fabricación.
                        </p>
                    </div>
                }
            />
        </div>
    )
}
