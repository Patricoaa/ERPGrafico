"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

import type { WorkOrder, WorkOrderMaterial } from "../../types"

interface MaterialAdjustment {
    material_id: number
    actual_quantity: number
}

interface RectificationStepProps {
    order: WorkOrder | null
    onChange: (materialAdjustments: MaterialAdjustment[], producedQuantity: number | null) => void
}

export function RectificationStep({ order, onChange }: RectificationStepProps) {
    const materials = order?.materials || []

    // Initialize actual quantities from planned quantities
    const [actualQuantities, setActualQuantities] = useState<Record<number, string>>(() => {
        const init: Record<number, string> = {}
        materials.forEach((m: WorkOrderMaterial) => {
            init[m.id] = String(m.quantity_planned)
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
            .filter((m: any) => !m.is_outsourced) // Only stock materials get rectified
            .map((m: any) => ({
                material_id: m.id,
                actual_quantity: parseFloat(actualQuantities[m.id] ?? String(m.quantity_planned)) || 0
            }))

        const producedQty = isManualWithInventory && actualProducedQty
            ? parseFloat(actualProducedQty) || null
            : null

        onChange(adjustments, producedQty)
    }, [actualQuantities, actualProducedQty])

    const handleQuantityChange = (materialId: number, value: string) => {
        setActualQuantities(prev => ({ ...prev, [materialId]: value }))
    }

    const resetAll = () => {
        const reset: Record<number, string> = {}
        materials.forEach((m: any) => { reset[m.id] = String(m.quantity_planned) })
        setActualQuantities(reset)
        if (isManualWithInventory) setActualProducedQty(plannedProducedQty)
    }

    const getDiff = (planned: number, actual: string) => {
        const a = parseFloat(actual)
        if (isNaN(a)) return null
        return a - planned
    }

    const hasMeaningfulChanges = materials.some((m: any) => {
        const diff = getDiff(parseFloat(m.quantity_planned), actualQuantities[m.id] ?? String(m.quantity_planned))
        return diff !== null && diff !== 0
    }) || (isManualWithInventory && parseFloat(actualProducedQty) !== parseFloat(plannedProducedQty))

    const stockMaterials = materials.filter((m: any) => !m.is_outsourced)
    const outsourcedMaterials = materials.filter((m: any) => m.is_outsourced)

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

            {/* Materials Table */}
            {stockMaterials.length > 0 ? (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Materiales de Stock</span>
                        <Badge variant="secondary" className="text-xs">{stockMaterials.length}</Badge>
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
                                {stockMaterials.map((material: any, idx: number) => {
                                    const planned = parseFloat(material.quantity_planned)
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
                                            </td>
                                            <td className="px-4 py-3 text-right text-muted-foreground">
                                                {Number(planned).toLocaleString('es-CL', { maximumFractionDigits: 4 })}
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
                                                        {isMore ? "+" : ""}{Number(diff).toLocaleString('es-CL', { maximumFractionDigits: 4 })}
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

            {/* Outsourced Materials (read-only, just informational) */}
            {outsourcedMaterials.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-muted-foreground">Servicios Tercerizados</span>
                        <Badge variant="outline" className="text-xs">No rectificables</Badge>
                    </div>
                    <div className="rounded-lg border border-dashed border-border p-3 space-y-1">
                        {outsourcedMaterials.map((m: any) => (
                            <div key={m.id} className="flex items-center justify-between text-sm text-muted-foreground py-0.5">
                                <span>{m.component_name}</span>
                                <span>{Number(m.quantity_planned).toLocaleString('es-CL', { maximumFractionDigits: 4 })} {m.uom_name}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                        Los servicios tercerizados se registran mediante sus Órdenes de Compra y no requieren rectificación.
                    </p>
                </div>
            )}

            {/* Produced Quantity (only for manual OTs with inventory tracking) */}
            {isManualWithInventory && (
                <div className="rounded-lg border border-border p-4 bg-card space-y-3">
                    <div className="flex items-center gap-2">
                        <Scale className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">Cantidad Real Producida</span>
                        <Badge variant="secondary" className="text-xs">Solo OT de Stock</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center">
                        <div>
                            <Label className="text-xs text-muted-foreground mb-1.5 block">Cantidad planificada</Label>
                            <div className="text-lg font-semibold text-foreground">
                                {Number(plannedProducedQty).toLocaleString('es-CL', { maximumFractionDigits: 4 })}
                                <span className="text-sm text-muted-foreground ml-1.5">{order?.product?.uom?.name || "un."}</span>
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground mb-1.5 block">Cantidad real producida</Label>
                            <Input
                                type="number"
                                min="0.001"
                                step="any"
                                value={actualProducedQty}
                                onChange={e => setActualProducedQty(e.target.value)}
                                className={cn(
                                    "h-9",
                                    parseFloat(actualProducedQty) !== parseFloat(plannedProducedQty) &&
                                    "border-warning focus-visible:ring-warning"
                                )}
                                placeholder="Ej: 95"
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
