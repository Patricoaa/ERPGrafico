"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Edit, Settings2 } from "lucide-react"
import { AdvancedManufacturingDrawer } from "../forms/AdvancedManufacturingDrawer"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { mfgDetailLineEntity, mfgDetailLineViews, getMfgLineSubType, type ManufacturableLine } from "../../entity-view/mfgDetailLine.entity"

import { type SaleOrderLine } from "../../types"

interface Step2_ManufacturingDetailsProps {
    orderLines: SaleOrderLine[]
    setOrderLines: (lines: SaleOrderLine[]) => void
}

export function Step2_ManufacturingDetails({ orderLines, setOrderLines }: Step2_ManufacturingDetailsProps) {
    const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)

    const manufacturableItems: ManufacturableLine[] = orderLines
        .map((line, index) => ({ ...line, originalIndex: index }))
        .filter(line => line.product_type === 'MANUFACTURABLE') as ManufacturableLine[]

    const handleConfirmManufacturing = (data: Record<string, unknown>) => {
        if (editingLineIndex === null) return
        const newLines = [...orderLines]
        const line = newLines[editingLineIndex]
        newLines[editingLineIndex] = { ...line, manufacturing_data: data }
        setOrderLines(newLines)
        setEditingLineIndex(null)
    }

    const mfgCollection = useEntityCollection(
        mfgDetailLineEntity,
        { rows: manufacturableItems },
        { pagination: { mode: "none" } }
    )

    const editingLineRaw = editingLineIndex !== null ? orderLines[editingLineIndex] : null
    const editingLine = editingLineRaw && getMfgLineSubType(editingLineRaw) === 'ADVANCED' ? editingLineRaw : null

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground mb-2">
                    Revise y confirme los detalles técnicos de los productos a fabricar.
                </p>

                <Collection.Root
                    collection={mfgCollection}
                    label="Líneas fabricables"
                    actions={(row) => {
                        const subtype = getMfgLineSubType(row)
                        if (subtype !== 'ADVANCED') return null
                        const hasConfig = !!row.manufacturing_data
                        return (
                            <Button
                                variant={hasConfig ? "outline" : "default"}
                                size="sm"
                                onClick={() => setEditingLineIndex(row.originalIndex)}
                                className={cn(
                                    "h-7 text-3xs font-medium uppercase tracking-tight",
                                    !hasConfig && "bg-primary hover:bg-primary/90 text-primary-foreground shadow-card"
                                )}
                            >
                                {hasConfig ? (
                                    <Edit className="mr-1.5 h-3 w-3" />
                                ) : (
                                    <Settings2 className="mr-1.5 h-3 w-3" />
                                )}
                                {hasConfig ? "Editar" : "Configurar"}
                            </Button>
                        )
                    }}
                >
                    <Collection.View
                        table={mfgDetailLineViews.table}
                        emptyTitle="Sin productos fabricables"
                        emptyDescription="No hay productos fabricables en esta orden."
                    />
                </Collection.Root>
            </div>

            {editingLine && (
                <AdvancedManufacturingDrawer
                    open={editingLineIndex !== null}
                    onOpenChange={(open) => !open && setEditingLineIndex(null)}
                    product={{
                        ...editingLine,
                        id: editingLine.id as number,
                        requires_advanced_manufacturing: true,
                        mfg_enable_prepress: editingLine.mfg_enable_prepress ?? true,
                        mfg_enable_press: editingLine.mfg_enable_press ?? true,
                        mfg_enable_postpress: editingLine.mfg_enable_postpress ?? true
                    }}
                    onConfirm={handleConfirmManufacturing}
                />
            )}
        </div>
    )
}
