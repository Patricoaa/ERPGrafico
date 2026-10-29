"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import type { ReactNode } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import {
    CheckCircle2,
    ClipboardList,
    Package,
    RotateCcw,
    TrendingDown,
    TrendingUp,
    Info,
    Scale
} from "lucide-react"
import { Chip, QuantityDisplay, LabeledInput, StepHeader } from "@/components/shared"
import { EditableCollection, initialEditableValues, type EditableRowValue } from "@/components/entity-view"
import { stockMatEditable, outsourcedMatEditable } from '../../entity-view/workOrderMaterial.entity'

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
    headerActions?: ReactNode
    onChange: (
        materialAdjustments: MaterialAdjustment[],
        producedQuantity: number | null,
        outsourcedAdjustments?: OutsourcedAdjustment[]
    ) => void
}

interface CostImpactPanelProps {
    materials: WorkOrderMaterial[]
    stockValues: EditableRowValue[]
    outsourcedValues: EditableRowValue[]
    actualProducedQty: string
    plannedProducedQty: string
    isManualWithInventory: boolean
}

function CostImpactPanel({
    materials, stockValues, outsourcedValues, actualProducedQty, plannedProducedQty, isManualWithInventory
}: CostImpactPanelProps) {
    const stockByKey = useMemo(() => new Map(stockValues.map(v => [v.key, v.values])), [stockValues])
    const outsourcedByKey = useMemo(() => new Map(outsourcedValues.map(v => [v.key, v.values])), [outsourcedValues])

    const plannedTotal = materials.reduce((sum, m) => {
        if (!m.is_outsourced) return sum + (m.planned_cost ?? m.total_cost ?? 0)
        return sum + (parseFloat(String(m.unit_price ?? 0)) * m.quantity_planned)
    }, 0)

    const actualTotal = materials.reduce((sum, m) => {
        if (!m.is_outsourced) {
            const vals = stockByKey.get(String(m.id))
            const qty = vals?.actualQty ?? m.quantity_planned
            const unitCost = (m.planned_cost ?? m.total_cost ?? 0) / (m.quantity_planned || 1)
            return sum + qty * unitCost
        }
        const vals = outsourcedByKey.get(String(m.id))
        const qty = vals?.actualQty ?? m.quantity_planned
        const price = vals?.actualPrice ?? (parseFloat(m.unit_price ?? "0") || 0)
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
        <div className="rounded-md border border-primary/20 bg-primary/5 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <Info className="h-3.5 w-3.5" />
                Impacto de costos estimado
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
                <div className="space-y-0.5">
                    <p className="text-3xs text-muted-foreground uppercase font-bold">Costo planificado</p>
                    <p className="text-sm font-bold">${plannedTotal.toFixed(0)}</p>
                </div>
                <div className="space-y-0.5">
                    <p className="text-3xs text-muted-foreground uppercase font-bold">Costo real</p>
                    <p className={`text-sm font-bold ${isIncrease ? "text-destructive" : "text-success"}`}>
                        ${actualTotal.toFixed(0)}
                    </p>
                </div>
                <div className="space-y-0.5">
                    <p className="text-3xs text-muted-foreground uppercase font-bold">Δ Total</p>
                    <p className={`text-sm font-bold flex items-center justify-center gap-1 ${isIncrease ? "text-destructive" : "text-success"}`}>
                        {isIncrease ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {isIncrease ? '+' : ''}{delta.toFixed(0)}
                    </p>
                </div>
            </div>
            {isManualWithInventory && (
                <div className="border-t border-primary/10 pt-3 grid grid-cols-2 gap-3 text-center">
                    <div className="space-y-0.5">
                        <p className="text-3xs text-muted-foreground uppercase font-bold">Costo unit. planif.</p>
                        <p className="text-sm font-bold">${plannedUnitCost.toFixed(2)}</p>
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-3xs text-muted-foreground uppercase font-bold">Costo unit. real</p>
                        <p className={`text-sm font-bold ${unitDelta > 0 ? "text-destructive" : "text-success"}`}>
                            ${actualUnitCost.toFixed(2)}
                            <span className="text-3xs ml-1">({unitDelta > 0 ? '+' : ''}{unitDelta.toFixed(2)})</span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

export function RectificationStep({ order, headerActions, onChange }: RectificationStepProps) {
    const materials = order?.materials || []
    const stockMaterials = materials.filter((m: WorkOrderMaterial) => !m.is_outsourced)
    const outsourcedMaterials = materials.filter((m: WorkOrderMaterial) => m.is_outsourced)

    const [stockValues, setStockValues] = useState<EditableRowValue[]>(() =>
        initialEditableValues(stockMatEditable, stockMaterials)
    )
    const [outsourcedValues, setOutsourcedValues] = useState<EditableRowValue[]>(() =>
        initialEditableValues(outsourcedMatEditable, outsourcedMaterials)
    )

    const plannedProducedQty = order?.stage_data?.quantity ? String(order.stage_data.quantity) : ""
    const isManualWithInventory = order?.is_manual && order?.product?.track_inventory
    const [actualProducedQty, setActualProducedQty] = useState<string>(plannedProducedQty)

    const isFirstMountRef = useRef(true)

    useEffect(() => {
        if (isFirstMountRef.current) {
            isFirstMountRef.current = false
            return
        }
        const adjustments: MaterialAdjustment[] = stockValues.map(v => ({
            material_id: Number(v.key),
            actual_quantity: v.values.actualQty ?? 0,
        }))
        const outsourcedAdj: OutsourcedAdjustment[] = outsourcedValues.map(v => ({
            material_id: Number(v.key),
            actual_quantity: v.values.actualQty ?? 0,
            actual_unit_price: v.values.actualPrice ?? 0,
        }))
        const producedQty = isManualWithInventory && actualProducedQty
            ? parseFloat(actualProducedQty) || null
            : null
        onChange(adjustments, producedQty, outsourcedAdj)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stockValues, outsourcedValues, actualProducedQty])

    const hasMeaningfulChanges = useMemo(() => {
        const stockChanged = stockValues.some(v => {
            const row = stockMaterials.find(m => String(m.id) === v.key)
            return row && (v.values.actualQty ?? row.quantity_planned) !== row.quantity_planned
        })
        const outsourcedChanged = outsourcedValues.some(v => {
            const row = outsourcedMaterials.find(m => String(m.id) === v.key)
            if (!row) return false
            const plannedPrice = parseFloat(row.unit_price ?? "0") || 0
            return (v.values.actualQty ?? row.quantity_planned) !== row.quantity_planned
                || (v.values.actualPrice ?? plannedPrice) !== plannedPrice
        })
        const producedChanged = !!isManualWithInventory
            && parseFloat(actualProducedQty) !== parseFloat(plannedProducedQty)
        return stockChanged || outsourcedChanged || producedChanged
    }, [stockValues, outsourcedValues, stockMaterials, outsourcedMaterials, isManualWithInventory, actualProducedQty, plannedProducedQty])

    const resetAll = () => {
        setStockValues(initialEditableValues(stockMatEditable, stockMaterials))
        setOutsourcedValues(initialEditableValues(outsourcedMatEditable, outsourcedMaterials))
        if (isManualWithInventory) setActualProducedQty(plannedProducedQty)
    }

    return (
        <div className="space-y-6 p-1">
            <StepHeader
                title="Rectificación de Producción"
                description="Declare las cantidades reales consumidas. Esto ajustará los movimientos de inventario antes de finalizar."
                icon={ClipboardList}
                rightContent={
                    <div className="flex items-center gap-2">
                        {hasMeaningfulChanges && (
                            <Button variant="ghost" size="sm" onClick={resetAll} className="shrink-0 text-muted-foreground hover:text-foreground">
                                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                Restablecer
                            </Button>
                        )}
                        {headerActions}
                    </div>
                }
            />

            {hasMeaningfulChanges && (
                <Alert variant="warning">
                    <AlertDescription className="text-sm text-warning font-medium">
                        Las cantidades han sido modificadas. Al finalizar, se crearán movimientos de inventario compensatorios y se recalcularán los costos de producción.
                    </AlertDescription>
                </Alert>
            )}

            {hasMeaningfulChanges && (
                <CostImpactPanel
                    materials={materials}
                    stockValues={stockValues}
                    outsourcedValues={outsourcedValues}
                    actualProducedQty={actualProducedQty}
                    plannedProducedQty={plannedProducedQty}
                    isManualWithInventory={!!isManualWithInventory}
                />
            )}

            {/* Stock Materials */}
            {stockMaterials.length > 0 ? (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Materiales de Stock</span>
                        <Chip size="xs">{stockMaterials.length}</Chip>
                    </div>
                    <EditableCollection
                        definition={stockMatEditable}
                        rows={stockMaterials}
                        value={stockValues}
                        onChange={setStockValues}
                        label="Materiales de stock a rectificar"
                    />
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
                    <EditableCollection
                        definition={outsourcedMatEditable}
                        rows={outsourcedMaterials}
                        value={outsourcedValues}
                        onChange={setOutsourcedValues}
                        label="Servicios tercerizados a rectificar"
                    />
                </div>
            )}

            {/* Produced Quantity (only for manual OTs with inventory tracking) */}
            {isManualWithInventory && (
                <div className="surface-panel p-4 space-y-3">
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
                                containerClassName={
                                    parseFloat(actualProducedQty) !== parseFloat(plannedProducedQty)
                                        ? "[&_fieldset]:border-warning [&_legend]:text-warning"
                                        : undefined
                                }
                            />
                        </div>
                    </div>

                    {parseFloat(actualProducedQty) !== parseFloat(plannedProducedQty) && actualProducedQty !== "" && (
                        <Alert variant="warning">
                            <AlertDescription className="text-xs text-warning font-medium">
                                El cambio en la cantidad producida recalculará el <strong>Costo Promedio Ponderado (WAC)</strong> del producto terminado en inventario.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            )}

            {!hasMeaningfulChanges && stockMaterials.length > 0 && (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-success font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Todo producido según lo planificado. Puede finalizar sin cambios.</span>
                </div>
            )}
        </div>
    )
}
