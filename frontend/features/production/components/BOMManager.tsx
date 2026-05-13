"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
    Plus, Edit, Trash2, Workflow, Box, Layers, Copy
} from "lucide-react"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { BOMFormModal } from "./BOMFormModal"

import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { LabeledSelect } from "@/components/shared"
import { cn } from "@/lib/utils"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"

import { BOM, ProductMinimal } from "../types"

interface BOMManagerProps {
    product: ProductMinimal | null
    variantMode?: boolean
    onBomsChange?: (boms: BOM[]) => void
}

import { useBOMs, useProductionVariants } from "../hooks/useBOMs"

export function BOMManager({ product, variantMode = false, onBomsChange }: BOMManagerProps) {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingBom, setEditingBom] = useState<BOM | undefined>(undefined)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [bomToDelete, setBomToDelete] = useState<BOM | undefined>(undefined)

    // Variant support
    const [selectedVariantId, setSelectedVariantId] = useState<string>("all")

    const bomParams = selectedVariantId && selectedVariantId !== "all"
        ? { product_id: selectedVariantId }
        : { parent_id: product?.id }

    const { boms, isBOMsLoading, refetch, deleteBom, toggleActive } = useBOMs(bomParams)
    const { variants, isVariantsLoading } = useProductionVariants(product?.id)

    // Sync external boms if needed
    useEffect(() => {
        onBomsChange?.(boms)
    }, [boms, onBomsChange])

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
            await deleteBom(bom.id as number)
            setIsDeleteModalOpen(false)
        } catch {
            // Error handled by hook toast
        }
    }

    const handleToggleActive = async (bom: BOM) => {
        if (bom.active) return
        try {
            await toggleActive(bom.id as number)
        } catch {
            // Error handled by hook toast
        }
    }

    if (!product?.id) {
        return (
            <div className="p-12 text-center border-2 border-dashed rounded-md bg-muted/5 text-muted-foreground animate-in fade-in zoom-in-95 duration-500">
                <Box className="h-10 w-10 mx-auto mb-4 opacity-30 text-primary" />
                <h3 className="text-sm font-black uppercase text-primary tracking-widest leading-none mb-1">Producto no guardado</h3>
                <p className="text-[10px] font-medium uppercase tracking-tight">Guarde los cambios iniciales para gestionar su estructura técnica.</p>
            </div>
        )
    }

    const columns: ColumnDef<BOM>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Lista de Materiales (Receta)" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center py-1 text-center w-full">
                    <DataCell.Text className="font-black text-[12px] tracking-tight uppercase leading-none">{row.original.name}</DataCell.Text>
                    {row.original.notes && (
                        <DataCell.Secondary className="text-[10px] italic truncate max-w-[200px] mt-1">{row.original.notes}</DataCell.Secondary>
                    )}
                </div>
            )
        },
        {
            accessorKey: "product_id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Variante / Contexto" className="justify-center" />,
            cell: ({ row }) => {
                const isBase = Number(row.original.product) === Number(product?.id)
                return (
                    <div className="flex items-center justify-center gap-2 w-full">
                        {isBase ? (
                            <DataCell.Badge
                                variant="outline"
                                className="text-[9px] font-black uppercase tracking-widest bg-primary/5 text-primary border-primary/20 h-5 px-1.5"
                            >
                                BASE
                            </DataCell.Badge>
                        ) : (
                            <div className="flex flex-col items-center gap-0.5">
                                <DataCell.Code>{row.original.product_internal_code || 'VAR'}</DataCell.Code>
                                <DataCell.Secondary className="text-[10px] truncate max-w-[120px]">{row.original.product_name}</DataCell.Secondary>
                            </div>
                        )}
                    </div>
                )
            }
        },
        {
            accessorKey: "yield_quantity",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Rendimiento (Output)" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.NumericFlow
                        value={row.original.yield_quantity}
                        unit={row.original.yield_uom_name || product?.uom_name}
                    />
                </div>
            )
        },
        {
            accessorKey: "active",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={() => !row.original.active && handleToggleActive(row.original)}
                        className={cn(!row.original.active && "hover:scale-105 transition-transform")}
                    >
                        <StatusBadge
                            status={row.original.active ? "active" : "inactive"}
                            className="cursor-pointer"
                        />
                    </button>
                </div>
            )
        },
        {
            accessorKey: "lines_count",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Comp." className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <DataCell.Secondary className="font-black opacity-60">
                        {`${row.original.lines?.length || 0} ITEMS`}
                    </DataCell.Secondary>
                </div>
            )
        },
        {
            accessorKey: "updated_at",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Actualizado" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Date value={row.original.updated_at} className="text-[10px] font-medium opacity-50" />
                </div>
            )
        },
        createActionsColumn<BOM>({
            headerLabel: "Opciones",
            renderActions: (item) => (
                <>
                    <DataCell.Action
                        icon={Copy}
                        title="Clonar Receta"
                        className="text-success hover:text-success"
                        onClick={() => handleClone(item)}
                    />
                    <DataCell.Action
                        icon={Edit}
                        title="Editar"
                        className="text-primary hover:text-primary"
                        onClick={() => handleEdit(item)}
                    />
                    <DataCell.Action
                        icon={Trash2}
                        title="Eliminar"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(item)}
                    />
                </>
            )
        })
    ]

    return (
        <>
            <div className={cn("w-full space-y-0 rounded-l border bg-muted/5 overflow-hidden", variantMode && "bg-transparent")}>
                {!variantMode && (
                    <div className="pb-6 px-6 pt-6 border-b bg-background/50">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                                <h3 className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2 leading-none">
                                    <Workflow className="h-4 w-4 text-primary opacity-50" />
                                    Estructuras Técnicas (BOM)
                                </h3>
                                <p className="text-[10px] font-bold uppercase text-muted-foreground mt-1.5 opacity-60">
                                    Gestión de fórmulas y procesos de fabricación
                                </p>
                            </div>

                            {!product?.has_variants && (
                                <Button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleCreate()
                                    }}
                                    className="h-9 px-5 gap-2 rounded-lg font-black uppercase tracking-widest text-[10px] shadow-sm transition-all hover:-translate-y-0.5"
                                >
                                    <Plus className="h-4 w-4" />
                                    Nueva Lista
                                </Button>
                            )}
                        </div>

                        {product?.has_variants && (
                            <div className="mt-6 bg-primary/5 p-5 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-500">
                                <div className="flex-1 flex flex-col md:flex-row items-center gap-4">
                                    <LabeledSelect
                                        label="Contexto de Manufactura"
                                        icon={<Layers className="h-4 w-4 opacity-50" />}
                                        containerClassName="flex-1"
                                        value={selectedVariantId}
                                        onChange={setSelectedVariantId}
                                        placeholder="Seleccione variante..."
                                        className="font-mono h-10"
                                        options={[
                                            { value: "all", label: "-- Ver Todas las Recetas --" },
                                            ...variants.map(v => ({
                                                value: v.id.toString(),
                                                label: (
                                                    <div className="flex items-center gap-3 font-bold uppercase">
                                                        <span className="font-mono bg-muted text-[9px] px-1.5 py-0.5 rounded-sm border">{v.internal_code || v.code}</span>
                                                        <span className="opacity-80">{v.variant_display_name || v.name}</span>
                                                    </div>
                                                )
                                            }))
                                        ]}
                                    />
                                    <Button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleCreate()
                                        }}
                                        className="w-full md:w-auto h-10 px-6 gap-2 rounded-lg font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5"
                                        disabled={selectedVariantId === "all"}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Configurar Receta
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {variantMode && (
                    <div className="flex justify-between items-center py-4 px-6 border-b bg-background/50">
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
                            className="h-8 gap-2 rounded-lg text-[10px] font-black uppercase tracking-widest border-2 border-primary/20 hover:bg-primary/5 text-primary"
                            variant="outline"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Añadir Receta
                        </Button>
                    </div>
                )}

                <div className="p-0 overflow-hidden">
                    <DataTable
                        columns={columns}
                        data={boms}
                        variant="embedded"
                        isLoading={isBOMsLoading}
                    />
                </div>
            </div>

            <BOMFormModal
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                product={
                    (selectedVariantId && selectedVariantId !== "all")
                        ? variants.find(v => v.id.toString() === selectedVariantId) || product
                        : product
                }
                bomToEdit={editingBom}
                onSuccess={() => {
                    refetch()
                }}
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
        </>
    )
}
