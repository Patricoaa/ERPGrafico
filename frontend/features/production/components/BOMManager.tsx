"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
    Plus, Workflow, Box, Layers, History
} from "lucide-react"

import { BOMDrawer } from "./BOMDrawer"

import { ActionConfirmModal, LabeledSelect } from '@/components/shared'
import { cn } from "@/lib/utils"
import { getDomainConceptCode, getDomainConceptLabel, getDomainConceptMessage, getDomainConceptTitle } from "@/lib/entity-registry"
import { bomManagerActions, type BOMManagerActionsCtx } from './bomManagerActions'
import { Collection, useEntityCollection } from "@/components/entity-view"
import { bomManagerEntity, bomManagerViews, type BOMManagerRow } from "../entity-view/bomManager.entity"

import { type BOM, type ProductMinimal } from "../types"

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
    const { variants } = useProductionVariants(product?.id)

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

    const handleToggleActive = useCallback(async (bom: BOM) => {
        if (bom.active) return
        try {
            await toggleActive(bom.id as number)
        } catch {
            // Error handled by hook toast
        }
    }, [toggleActive])

    const augmentedBoms = useMemo<BOMManagerRow[]>(() => boms.map(b => ({
        ...b,
        _fallbackUom: product?.uom_name,
        _isBase: Number(b.product) === Number(product?.id),
        _onToggle: b.active ? null : () => { void handleToggleActive(b) },
    })), [boms, product, handleToggleActive])

    const bomCollection = useEntityCollection(
        bomManagerEntity,
        { rows: augmentedBoms, isLoading: isBOMsLoading },
        { pagination: { mode: "none" } }
    )

    if (!product?.id) {
        return (
            <div className="p-12 text-center border-2 border-dashed rounded-md bg-muted/5 text-muted-foreground animate-in fade-in zoom-in-95 duration-500">
                <Box className="h-10 w-10 mx-auto mb-4 opacity-30 text-primary" />
                <h3 className="text-sm font-black uppercase text-primary tracking-widest leading-none mb-1">Producto no guardado</h3>
                <p className="text-3xs font-medium uppercase tracking-tight">Guarde los cambios iniciales para gestionar su estructura técnica.</p>
            </div>
        )
    }

    const bomManagerActionsCtx: BOMManagerActionsCtx = {
        onClone: (bom) => handleClone(bom as BOM),
        onEdit: (bom) => handleEdit(bom as BOM),
        onDelete: (bom) => handleDelete(bom as BOM, false),
    }

    return (
        <>
            <div className={cn("w-full h-full flex flex-col space-y-0 rounded-l border bg-muted/5 overflow-hidden", variantMode && "bg-transparent")}>
                {!variantMode && (
                    <div className="pb-6 px-6 pt-6 border-b bg-background/50">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                                <h3 className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2 leading-none">
                                    <Workflow className="h-4 w-4 text-primary opacity-50" />
                                    {getDomainConceptTitle('ldm', true)} ({getDomainConceptLabel('ldm')})
                                </h3>
                                <p className="text-3xs font-bold uppercase text-muted-foreground mt-1.5 opacity-60">
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
                                    className="h-9 px-5 gap-2 rounded-sm font-medium uppercase tracking-widest text-3xs shadow-card transition-all hover:-translate-y-0.5"
                                >
                                    <Plus className="h-4 w-4" />
                                    Nueva Lista
                                </Button>
                            )}
                        </div>

                        {product?.has_variants && (
                            <div className="mt-6 bg-primary/5 p-5 rounded-md border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-500">
                                <div className="flex-1 flex flex-col md:flex-row items-center gap-4">
                                    <LabeledSelect
                                        label="Contexto de Manufactura"
                                        icon={<Layers className="h-4 w-4 opacity-50" />}
                                        containerClassName="flex-1"
                                        value={selectedVariantId}
                                        onChange={setSelectedVariantId}
                                        className="font-mono h-10"
                                        options={[
                                            { value: "all", label: "-- Ver todas las LdM --" },
                                            ...variants.map(v => ({
                                                value: v.id.toString(),
                                                label: (
                                                    <div className="flex items-center gap-3 font-bold uppercase">
                                                        <span className="font-mono bg-muted text-4xs px-1.5 py-0.5 rounded-sm border">{v.internal_code || v.code}</span>
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
                                        className="w-full md:w-auto h-10 px-6 gap-2 rounded-sm font-medium uppercase tracking-widest text-2xs  transition-all hover:-translate-y-0.5"
                                        disabled={selectedVariantId === "all"}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Configurar LdM
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
                            <span className="font-bold uppercase text-3xs tracking-widest text-primary">LdM de esta variante</span>
                        </div>
                        <Button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                handleCreate()
                            }}
                            className="h-8 gap-2 rounded-sm text-3xs font-medium uppercase tracking-widest border-2 border-primary/20 hover:bg-primary/5 text-primary"
                            variant="outline"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Añadir LdM
                        </Button>
                    </div>
                )}

                <div className="p-0 flex-1 min-h-0">
                    {!isBOMsLoading && boms.length === 0 ? (
                        <div className="py-16 flex flex-col items-center justify-center text-center gap-5 border-2 border-dashed border-primary/20 rounded-b-md bg-muted/5">
                            <div className="bg-primary/10 p-5 rounded-full ring-4 ring-primary/5">
                                <Workflow className="h-10 w-10 text-primary" />
                            </div>
                            <div className="space-y-1.5 max-w-sm">
                                <p className="text-base font-black uppercase tracking-widest text-primary">Sin LdM de producción</p>
                                <p className="text-sm font-medium text-muted-foreground/80">
                                    Defina la {getDomainConceptCode('ldm')} y el ruteo de etapas para fabricar este producto.
                                </p>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                                <Button
                                    type="button"
                                    onClick={handleCreate}
                                    className="gap-2 h-10 px-6 text-xs font-black uppercase tracking-widest shadow-elevated hover:-translate-y-0.5 transition-transform"
                                >
                                    <Plus className="h-4 w-4" />
                                    Crear LdM base
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        // TODO: Implement generate from history
                                        handleCreate()
                                    }}
                                    className="gap-2 h-10 px-6 text-xs font-black uppercase tracking-widest border-primary/20 text-primary hover:bg-primary/5"
                                    title="Próximamente: Auto-completar según OTs manuales previas"
                                >
                                    <History className="h-4 w-4" />
                                    Generar desde histórico
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Collection.Root
                            collection={bomCollection}
                            label="Estructuras técnicas"
                            actions={bomManagerActions.forCollection(bomManagerActionsCtx)}
                        >
                            <Collection.View
                                table={bomManagerViews.table}
                                emptyTitle="Sin LdM"
                                emptyDescription="No se encontraron estructuras técnicas."
                            />
                        </Collection.Root>
                    )}
                </div>
            </div>

            <BOMDrawer
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
                title={getDomainConceptMessage('ldm', 'delete')}
                variant="destructive"
                onConfirm={() => { if (bomToDelete) return handleDelete(bomToDelete, true) }}
                confirmText={getDomainConceptMessage('ldm', 'delete')}
                description={
                    <div className="space-y-3 pt-2">
                        <p className="text-sm font-bold uppercase tracking-tight">
                            ¿Está seguro de que desea eliminar la LdM <strong>{bomToDelete?.name}</strong>?
                        </p>
                        <p className="text-2xs font-medium text-muted-foreground bg-destructive/5 p-3 border-l-4 border-destructive">
                            Esta acción no se puede deshacer y el producto perderá esta definición técnica de fabricación.
                        </p>
                    </div>
                }
            />
        </>
    )
}
