"use client"

import React from "react"
import { notFound } from "next/navigation"
import { EntityDetailPage, LabeledContainer, SkeletonShell, Chip, MoneyDisplay } from "@/components/shared"
import { formatPlainDate } from "@/lib/utils"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { useStockMove, type StockMove } from "@/features/inventory/hooks/useStockMoves"

// Forma extendida del detalle (incluye campos no presentes en el shape de la lista).
type StockMoveDetail = StockMove & {
    product_details?: { name: string }
    warehouse_details?: { name: string }
    uom_details?: { name: string }
    unit_cost?: number | string
    adjustment_reason?: string
    journal_entry?: string
}

interface StockMoveDetailClientProps {
    moveId: string
}

// Placeholder tipado para el esqueleto - sigue el patrón del contrato
const STOCK_MOVE_SKELETON: StockMove = {
    id: 0,
    date: "",
    product_name: "————————————",
    product_internal_code: "————————————",
    product_code: "————————————",
    warehouse_name: "————————————",
    quantity: "0",
    uom_name: "————————————",
    move_type: "IN", // valor por defecto válido
    description: "————————————",
    related_documents: [
        { type: "—", id: 0, name: "————————————" },
        { type: "—", id: 0, name: "————————————" },
        { type: "—", id: 0, name: "————————————" }
    ]
}

export function StockMoveDetailClient({ moveId }: StockMoveDetailClientProps) {
    // useStockMove cachea por STOCK_MOVES_QUERY_KEY + ['detail', id] → cualquier
    // mutación que invalide STOCK_MOVES_QUERY_KEY (p.ej. useStockAdjustment)
    // refresca también este detalle.
    const { data: move, isLoading: loading, error: queryError } = useStockMove<StockMoveDetail>(moveId)

    const error = queryError ? (queryError as { response?: { status?: number } })?.response?.status ?? 500 : null

    if (error === 404) return notFound()
    if (error) return <div className="p-8 text-destructive">Error al cargar el movimiento de stock</div>

    // Estado de carga manejado con SkeletonShell
    return (
        <SkeletonShell isLoading={loading || !move} ariaLabel="Cargando detalle de movimiento de stock">
            <EntityDetailPage
                entityLabel="inventory.stockmove"
                displayId={formatEntityDisplay('inventory.stockmove', move ?? STOCK_MOVE_SKELETON)}
                breadcrumb={[
                    { label: "Movimientos", href: "/inventory/moves" },
                    { label: formatEntityDisplay('inventory.stockmove', move ?? STOCK_MOVE_SKELETON), href: `/inventory/moves/${moveId}` }
                ]}
                instanceId={move?.id ?? 0}
                readonly={true}
            >
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <LabeledContainer label="Información General">
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <div>
                                        <span className="text-xs text-muted-foreground block">Fecha</span>
                                        <span className="text-sm font-medium">
                                            {formatPlainDate(move?.date ?? STOCK_MOVE_SKELETON.date)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-foreground block">Tipo</span>
                                        <div className="mt-1">
                                            <Chip 
                                                intent={move?.move_type === 'IN' ? 'success' : 
                                                       move?.move_type === 'OUT' ? 'destructive' : 
                                                       move?.move_type === 'ADJ' ? 'warning' : 'neutral'}
                                            >
                                                {move?.move_type === 'IN' ? 'Entrada' : 
                                                 move?.move_type === 'OUT' ? 'Salida' : 
                                                 move?.move_type === 'ADJ' ? 'Ajuste' : 
                                                 move?.move_type ?? STOCK_MOVE_SKELETON.move_type}
                                            </Chip>
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-xs text-muted-foreground block">Producto</span>
                                        <span className="text-sm font-medium">{move?.product_details?.name ?? move?.product_name ?? STOCK_MOVE_SKELETON.product_name}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-xs text-muted-foreground block">Bodega</span>
                                        <span className="text-sm font-medium">{move?.warehouse_details?.name ?? move?.warehouse_name ?? STOCK_MOVE_SKELETON.warehouse_name}</span>
                                    </div>
                                </div>
                            </LabeledContainer>
                        </div>

                        <div className="space-y-6">
                            <LabeledContainer label="Cantidades y Costos">
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <div>
                                        <span className="text-xs text-muted-foreground block">Cantidad</span>
                                        <span className="text-xl font-mono font-bold">
                                            {Number(move?.quantity ?? STOCK_MOVE_SKELETON.quantity).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                                        </span>
                                        <span className="text-xs ml-1 text-muted-foreground">
                                            {move?.uom_details?.name ?? move?.uom_name ?? STOCK_MOVE_SKELETON.uom_name}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-foreground block">Costo Unitario</span>
                                        <span className="text-sm font-medium">
                                            <MoneyDisplay amount={Number(move?.unit_cost ?? 0)} />
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-foreground block">Costo Total</span>
                                        <span className="text-sm font-bold text-primary">
                                            <MoneyDisplay amount={(Number(move?.quantity ?? STOCK_MOVE_SKELETON.quantity) || 0) * (Number(move?.unit_cost ?? 0) || 0)} />
                                        </span>
                                    </div>
                                </div>
                            </LabeledContainer>
                        </div>
                    </div>

                    {(move?.description || move?.adjustment_reason || move?.journal_entry) && (
                        <LabeledContainer label="Detalles Adicionales">
                            <div className="space-y-4 mt-2">
                                {move?.adjustment_reason && (
                                    <div>
                                        <span className="text-xs text-muted-foreground block">Motivo de Ajuste</span>
                                        <span className="text-sm">{move?.adjustment_reason ?? STOCK_MOVE_SKELETON.description}</span>
                                    </div>
                                )}
                                {move?.description && (
                                    <div>
                                        <span className="text-xs text-muted-foreground block">Descripción</span>
                                        <span className="text-sm">{move?.description ?? STOCK_MOVE_SKELETON.description}</span>
                                    </div>
                                )}
                                {move?.journal_entry && (
                                    <div>
                                        <span className="text-xs text-muted-foreground block">Asiento Contable</span>
                                        <span className="text-sm font-mono">{move?.journal_entry ?? '————————————'}</span>
                                    </div>
                                )}
                            </div>
                        </LabeledContainer>
                    )}
                </div>
            </EntityDetailPage>
        </SkeletonShell>
    )
}