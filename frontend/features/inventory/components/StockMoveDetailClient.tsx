"use client"

import React, { useState, useEffect } from "react"
import { notFound } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormSkeleton, LabeledContainer } from "@/components/shared"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { Badge } from "@/components/ui/badge"
import { formatEntityDisplay } from "@/lib/entity-registry"

interface StockMoveDetailClientProps {
    moveId: string
}

export function StockMoveDetailClient({ moveId }: StockMoveDetailClientProps) {
    const [move, setMove] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)

    useEffect(() => {
        api.get(`/inventory/stock_moves/${moveId}/`)
            .then(res => setMove(res.data))
            .catch(err => setError(err.response?.status || 500))
            .finally(() => setLoading(false))
    }, [moveId])

    if (error === 404) return notFound()
    if (error) return <div className="p-8 text-destructive">Error al cargar el movimiento de stock</div>
    
    if (loading || !move) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
            </div>
        )
    }

    const typeLabels: Record<string, string> = {
        'IN': 'Entrada',
        'OUT': 'Salida',
        'ADJ': 'Ajuste'
    }

    const typeColors: Record<string, string> = {
        'IN': 'bg-success/10 text-success hover:bg-success/20',
        'OUT': 'bg-destructive/10 text-destructive hover:bg-destructive/20',
        'ADJ': 'bg-warning/10 text-warning hover:bg-warning/20'
    }

    return (
        <EntityDetailPage
            entityLabel="inventory.stockmove"
            displayId={formatEntityDisplay('inventory.stockmove', move)}
            breadcrumb={[
                { label: "Movimientos", href: "/inventory/moves" },
                { label: formatEntityDisplay('inventory.stockmove', move), href: `/inventory/moves/${moveId}` }
            ]}
            instanceId={move.id}
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
                                        {move.date ? format(new Date(move.date), "dd/MM/yyyy", { locale: es }) : '-'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">Tipo</span>
                                    <div className="mt-1">
                                        <Badge variant="secondary" className={typeColors[move.move_type] || ''}>
                                            {typeLabels[move.move_type] || move.move_type}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-xs text-muted-foreground block">Producto</span>
                                    <span className="text-sm font-medium">{move.product_details?.name || move.product}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-xs text-muted-foreground block">Bodega</span>
                                    <span className="text-sm font-medium">{move.warehouse_details?.name || move.warehouse}</span>
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
                                        {Number(move.quantity).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                                    </span>
                                    <span className="text-xs ml-1 text-muted-foreground">
                                        {move.uom_details?.name || move.uom || 'Unidades'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">Costo Unitario</span>
                                    <span className="text-sm font-medium">
                                        <MoneyDisplay amount={Number(move.unit_cost) || 0} />
                                    </span>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">Costo Total</span>
                                    <span className="text-sm font-bold text-primary">
                                        <MoneyDisplay amount={(Number(move.quantity) || 0) * (Number(move.unit_cost) || 0)} />
                                    </span>
                                </div>
                            </div>
                        </LabeledContainer>
                    </div>
                </div>

                {(move.description || move.adjustment_reason || move.journal_entry) && (
                    <LabeledContainer label="Detalles Adicionales">
                        <div className="space-y-4 mt-2">
                            {move.adjustment_reason && (
                                <div>
                                    <span className="text-xs text-muted-foreground block">Motivo de Ajuste</span>
                                    <span className="text-sm">{move.adjustment_reason}</span>
                                </div>
                            )}
                            {move.description && (
                                <div>
                                    <span className="text-xs text-muted-foreground block">Descripción</span>
                                    <span className="text-sm">{move.description}</span>
                                </div>
                            )}
                            {move.journal_entry && (
                                <div>
                                    <span className="text-xs text-muted-foreground block">Asiento Contable</span>
                                    <span className="text-sm font-mono">{move.journal_entry}</span>
                                </div>
                            )}
                        </div>
                    </LabeledContainer>
                )}
            </div>
        </EntityDetailPage>
    )
}
