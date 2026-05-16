"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
    AlertTriangle,
    CheckCircle2,
    ClipboardList,
    Package,
    RotateCcw,
    TrendingDown,
    TrendingUp,
    Info,
    Scale
} from "lucide-react"
import { Chip, QuantityDisplay, LabeledInput } from "@/components/shared"

import type { WorkOrder, WorkOrderMaterial } from "../../types"

interface MaterialAdjustment {
    material_id: number
    actual_quantity: number
}

interface OutsourcedAdjustment {
    material_id: number
    actual_quantity?: number
    actual_unit_price?: number
}

interface RectificationStepProps {
    order: WorkOrder | null
    onChange: (
        materialAdjustments: MaterialAdjustment[], 
        producedQuantity: number | null,
        outsourcedAdjustments?: OutsourcedAdjustment[]
    ) => void
}

interface CostImpactPanelProps {
    materials: WorkOrderMaterial[]
    actualQuantities: Record<number, string>
    actualOutsourced: Record<number, { qty: string; price: string }>
    actualProducedQty: string
    plannedProducedQty: string
    isManualWithInventory: boolean
}

function CostImpactPanel({
    materials, actualQuantities, actualOutsourced, actualProducedQty, plannedProducedQty, isManualWithInventory
}: CostImpactPanelProps) {
    const plannedTotal = materials.reduce((sum, m) => {
        if (!m.is_outsourced) return sum + (m.planned_cost ?? m.total_cost ?? 0)
        return sum + (parseFloat(String(m.unit_price ?? 0)) * m.quantity_planned)
    }, 0)

    const actualTotal = materials.reduce((sum, m) => {
        if (!m.is_outsourced) {
            const qty = parseFloat(actualQuantities[m.id] ?? String(m.quantity_planned)) || 0
            const unitCost = (m.planned_cost ?? m.total_cost ?? 0) / (m.quantity_planned || 1)
            return sum + qty * unitCost
        }
        const out = actualOutsourced[m.id]
        const qty = parseFloat(out?.qty ?? String(m.quantity_planned)) || 0
        const price = parseFloat(out?.price ?? String(m.unit_price ?? 0)) || 0
        return sum + qty * price
    }, 0)

    const delta = actualTotal - plannedTotal
    const isIncrease = delta > 0

    const plannedQty = parseFloat(plannedProducedQty) || 1
    const actualQty = parseFloat(actualProducedQty) || plannedQty
    const plannedUnitCost = plannedTotal / plannedQty
    const actualUnitCost = actualTotal / actualQty
    const unitDelta = actualUnitCost - plannedUnitCost

    return (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <Info className="h-3.5 w-3.5" />
                Impacto de costos estimado
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
                <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Costo planificado</p>
                    <p className="text-sm font-bold">${plannedTotal.toFixed(0)}</p>
                </div>
                <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Costo real</p>
                    <p className={cn("text-sm font-bold", isIncrease ? "text-destructive" : "text-success")}>
                        ${actualTotal.toFixed(0)}
                    </p>
                </div>
                <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Δ Total</p>
                    <p className={cn("text-sm font-bold flex items-center justify-center gap-1", isIncrease ? "text-destructive" : "text-success")}>
                        {isIncrease ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {isIncrease ? '+' : ''}{delta.toFixed(0)}
                    </p>
                </div>
            </div>
            {isManualWithInventory && (
                <div className="border-t border-primary/10 pt-3 grid grid-cols-2 gap-3 text-center">
                    <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Costo unit. planif.</p>
                        <p className="text-sm font-bold">${plannedUnitCost.toFixed(2)}</p>
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Costo unit. real</p>
                        <p className={cn("text-sm font-bold", unitDelta > 0 ? "text-destructive" : "text-success")}>
                            ${actualUnitCost.toFixed(2)}
                            <span className="text-[10px] ml-1">({unitDelta > 0 ? '+' : ''}{unitDelta.toFixed(2)})</span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

export function RectificationStep({ order, onChange }: RectificationStepProps) {
    const materials = order?.materials || []

    // Initialize actual quantities from planned quantities
    const [actualQuantities, setActualQuantities] = useState<Record<number, string>>(() => {
        const init: Record<number, string> = {}
        materials.forEach((m: WorkOrderMaterial) => {
            if (!m.is_outsourced) init[m.id] = String(m.quantity_planned)
        })
        return init
    })

    const [actualOutsourced, setActualOutsourced] = useState<Record<number, { qty: string, price: string }>>(() => {
        const init: Record<number, { qty: string, price: string }> = {}
        materials.forEach((m: WorkOrderMaterial) => {
            if (m.is_outsourced) {
                init[m.id] = { qty: String(m.quantity_planned), price: String(m.unit_price ?? "0") }
            }
        })
        return init
    })

    const plannedProducedQty = order?.stage_data?.quantity ? String(order.stage_data.quantity) : ""
    const isManualWithInventory = order?.is_manual && order?.product?.track_inventory
    const [actualProducedQty, setActualProducedQty] = useState<string>(plannedProducedQty)

    const isFirstMountRef = useRef(true)

    // Notify parent whenever values change
    useEffect(() => {
        // Guard: Skip the first call to onChange during mount to avoid illegal state updates
        if (isFirstMountRef.current) {
            isFirstMountRef.current = false
            return
        }

        const adjustments: MaterialAdjustment[] = materials
            .filter((m: WorkOrderMaterial) => !m.is_outsourced) // Only stock materials get rectified
            .map((m: WorkOrderMaterial) => ({
                material_id: m.id,
                actual_quantity: parseFloat(actualQuantities[m.id] ?? String(m.quantity_planned)) || 0
            }))

        const outsourcedAdjustments: OutsourcedAdjustment[] = materials
            .filter((m: WorkOrderMaterial) => m.is_outsourced)
            .map((m: WorkOrderMaterial) => ({
                material_id: m.id,
                actual_quantity: parseFloat(actualOutsourced[m.id]?.qty ?? String(m.quantity_planned)) || 0,
                actual_unit_price: parseFloat(actualOutsourced[m.id]?.price ?? String(m.unit_price ?? "0")) || 0
            }))

        const producedQty = isManualWithInventory && actualProducedQty
            ? parseFloat(actualProducedQty) || null
            : null

        onChange(adjustments, producedQty, outsourcedAdjustments)
    }, [actualQuantities, actualProducedQty, actualOutsourced])

    const handleQuantityChange = (materialId: number, value: string) => {
        setActualQuantities(prev => ({ ...prev, [materialId]: value }))
    }

    const handleOutsourcedChange = (materialId: number, field: 'qty' | 'price', value: string) => {
        setActualOutsourced(prev => ({
            ...prev,
            [materialId]: { ...prev[materialId], [field]: value }
        }))
    }

    const resetAll = () => {
        const resetQty: Record<number, string> = {}
        const resetOut: Record<number, { qty: string, price: string }> = {}
        materials.forEach((m: WorkOrderMaterial) => { 
            if (!m.is_outsourced) {
                resetQty[m.id] = String(m.quantity_planned) 
            } else {
                resetOut[m.id] = { qty: String(m.quantity_planned), price: String(m.unit_price ?? "0") }
            }
        })
        setActualQuantities(resetQty)
        setActualOutsourced(resetOut)
        if (isManualWithInventory) setActualProducedQty(plannedProducedQty)
    }

    const getDiff = (planned: number, actual: string) => {
        const a = parseFloat(actual)
        if (isNaN(a)) return null
        return a - planned
    }

    const hasMeaningfulChanges = materials.some((m: WorkOrderMaterial) => {
        if (!m.is_outsourced) {
            const diff = getDiff(Number(m.quantity_planned), actualQuantities[m.id] ?? String(m.quantity_planned))
            return diff !== null && diff !== 0
        } else {
            const out = actualOutsourced[m.id]
            if (!out) return false
            const diffQty = getDiff(Number(m.quantity_planned), out.qty)
            const diffPrice = getDiff(Number(m.unit_price ?? "0"), out.price)
            return (diffQty !== null && diffQty !== 0) || (diffPrice !== null && diffPrice !== 0)
        }
    }) || (isManualWithInventory && parseFloat(actualProducedQty) !== parseFloat(plannedProducedQty))

    const stockMaterials = materials.filter((m: WorkOrderMaterial) => !m.is_outsourced)
    const outsourcedMaterials = materials.filter((m: WorkOrderMaterial) => m.is_outsourced)

    return (
        <div className="space-y-6 p-1">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-primary" />
                        Rectificación de Producción
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Declare las cantidades reales consumidas. Esto ajustará los movimientos de inventario antes de finalizar.
                    </p>
                </div>
                {hasMeaningfulChanges && (
                    <Button variant="ghost" size="sm" onClick={resetAll} className="shrink-0 text-muted-foreground hover:text-foreground">
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Restablecer
                    </Button>
                )}
            </div>

            {/* Impact alert when there are changes */}
            {hasMeaningfulChanges && (
                <Alert className="border-warning/30 bg-warning/5">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <AlertDescription className="text-sm text-warning font-medium">
                        Las cantidades han sido modificadas. Al finalizar, se crearán movimientos de inventario compensatorios y se recalcularán los costos de producción.
                    </AlertDescription>
                </Alert>
            )}

            {/* Cost Impact Panel — shown inline when there are changes */}
            {hasMeaningfulChanges && (
                <CostImpactPanel
                    materials={materials}
                    actualQuantities={actualQuantities}
                    actualOutsourced={actualOutsourced}
                    actualProducedQty={actualProducedQty}
                    plannedProducedQty={plannedProducedQty}
                    isManualWithInventory={!!isManualWithInventory}
                />
            )}

            {/* Materials Table */}
            {stockMaterials.length > 0 ? (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Materiales de Stock</span>
                        <Chip size="xs">{stockMaterials.length}</Chip>
                    </div>
                    <div className="rounded-lg border border-border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-muted/40 border-b border-border">
                                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Material</th>
                                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Planificado</th>
                                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-36">Real Consumido</th>
                                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-28">Diferencia</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stockMaterials.map((material: WorkOrderMaterial) => {
                                    const planned = material.quantity_planned
                                    const actualStr = actualQuantities[material.id] ?? String(planned)
                                    const diff = getDiff(planned, actualStr)
                                    const hasChange = diff !== null && diff !== 0
                                    const isMore = (diff ?? 0) > 0
                                    const isLess = (diff ?? 0) < 0

                                    return (
                                        <tr
                                            key={material.id}
                                            className={cn(
                                                "border-b border-border last:border-0 transition-colors",
                                                hasChange ? "bg-warning/5" : "hover:bg-muted/20"
                                            )}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-foreground">{material.component_name}</div>
                                                <div className="text-xs text-muted-foreground">{material.uom_name}</div>
                                                {(() => {
                                                    const pCost = material.planned_cost ?? 0;
                                                    const aCost = material.actual_cost ?? 0;
                                                    const cDiff = aCost - pCost;
                                                    const cPct = pCost > 0 ? (cDiff / pCost) : 0;
                                                    if (Math.abs(cPct) > 0.01) {
                                                        const isUp = cDiff > 0;
                                                        return (
                                                            <Badge variant="outline" className={cn(
                                                                "mt-1 text-[9px] px-1.5 py-0 h-4 border-0",
                                                                isUp ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
                                                            )}>
                                                                {isUp ? "Costo ↑" : "Costo ↓"} {Math.abs(cPct * 100).toFixed(1)}%
                                                            </Badge>
                                                        )
                                                    }
                                                    return null;
                                                })()}
                                            </td>
                                            <td className="px-4 py-3 text-right text-muted-foreground">
                                                <QuantityDisplay value={planned} decimals={4} inline />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={actualStr}
                                                    onChange={e => handleQuantityChange(material.id, e.target.value)}
                                                    className={cn(
                                                        "w-28 text-right h-8 text-sm ml-auto",
                                                        hasChange && "border-warning focus-visible:ring-warning"
                                                    )}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {diff === null || diff === 0 ? (
                                                    <span className="flex items-center justify-end gap-1 text-muted-foreground">
                                                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                                        <span className="text-xs">Sin cambios</span>
                                                    </span>
                                                ) : (
                                                    <span className={cn(
                                                        "flex items-center justify-end gap-1 text-xs font-semibold",
                                                        isMore ? "text-warning" : "text-success"
                                                    )}>
                                                        {isMore
                                                            ? <TrendingUp className="h-3.5 w-3.5" />
                                                            : <TrendingDown className="h-3.5 w-3.5" />
                                                        }
                                                        {isMore ? "+" : ""}<QuantityDisplay value={diff} decimals={4} inline />
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <Alert className="border-border bg-muted/20">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <AlertDescription className="text-sm text-muted-foreground">
                        Esta OT no tiene materiales de stock a rectificar.
                    </AlertDescription>
                </Alert>
            )}

            {/* Outsourced Materials */}
            {outsourcedMaterials.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Servicios Tercerizados</span>
                        <Chip size="xs">{outsourcedMaterials.length}</Chip>
                    </div>
                    <div className="rounded-lg border border-border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-muted/40 border-b border-border">
                                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Servicio</th>
                                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-24">Cant. Real</th>
                                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-32">Precio Unit. Real</th>
                                </tr>
                            </thead>
                            <tbody>
                                {outsourcedMaterials.map((m: WorkOrderMaterial) => {
                                    const out = actualOutsourced[m.id]
                                    const actualQty = out?.qty ?? String(m.quantity_planned)
                                    const actualPrice = out?.price ?? String(m.unit_price ?? "0")
                                    const diffQty = getDiff(m.quantity_planned, actualQty)
                                    const diffPrice = getDiff(Number(m.unit_price ?? "0"), actualPrice)
                                    const hasChange = (diffQty !== null && diffQty !== 0) || (diffPrice !== null && diffPrice !== 0)
                                    
                                    return (
                                        <tr
                                            key={m.id}
                                            className={cn(
                                                "border-b border-border last:border-0 transition-colors",
                                                hasChange ? "bg-warning/5" : "hover:bg-muted/20"
                                            )}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-foreground">{m.component_name}</div>
                                                {m.purchase_order_number && (
                                                    <div className="text-xs text-muted-foreground mt-0.5">OC-{m.purchase_order_number}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={actualQty}
                                                    onChange={e => handleOutsourcedChange(m.id, 'qty', e.target.value)}
                                                    className={cn(
                                                        "w-20 text-right h-8 text-sm ml-auto",
                                                        diffQty && "border-warning focus-visible:ring-warning"
                                                    )}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={actualPrice}
                                                    onChange={e => handleOutsourcedChange(m.id, 'price', e.target.value)}
                                                    className={cn(
                                                        "w-28 text-right h-8 text-sm ml-auto",
                                                        diffPrice && "border-warning focus-visible:ring-warning"
                                                    )}
                                                />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Produced Quantity (only for manual OTs with inventory tracking) */}
            {isManualWithInventory && (
                <div className="rounded-lg border border-border p-4 bg-card space-y-3">
                    <div className="flex items-center gap-2">
                        <Scale className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">Cantidad Real Producida</span>
                        <Chip size="xs">Solo OT de Stock</Chip>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-start">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1.5">Cantidad planificada</p>
                            <div className="text-lg font-semibold text-foreground flex items-center">
                                <QuantityDisplay value={plannedProducedQty} decimals={4} inline />
                                <span className="text-sm text-muted-foreground ml-1.5">{order?.product?.uom?.name || "un."}</span>
                            </div>
                        </div>
                        <div>
                            <LabeledInput
                                label="Cantidad real producida"
                                type="number"
                                min="0.001"
                                step="any"
                                value={actualProducedQty}
                                onChange={e => setActualProducedQty(e.target.value)}
                                placeholder="Ej: 95"
                                containerClassName={cn(
                                    parseFloat(actualProducedQty) !== parseFloat(plannedProducedQty) &&
                                    "[&_fieldset]:border-warning [&_legend]:text-warning"
                                )}
                            />
                        </div>
                    </div>

                    {parseFloat(actualProducedQty) !== parseFloat(plannedProducedQty) && actualProducedQty !== "" && (
                        <Alert className="border-warning/30 bg-warning/5 py-2.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                            <AlertDescription className="text-xs text-warning font-medium">
                                El cambio en la cantidad producida recalculará el <strong>Costo Promedio Ponderado (WAC)</strong> del producto terminado en inventario.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            )}

            {/* No changes summary */}
            {!hasMeaningfulChanges && stockMaterials.length > 0 && (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-success font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Todo producido según lo planificado. Puede finalizar sin cambios.</span>
                </div>
            )}
        </div>
    )
}
